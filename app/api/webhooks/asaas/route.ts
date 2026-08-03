import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  translateEvent,
  storeIdFromEvent,
  checkoutLinkFromEvent,
  customerIdFromEvent,
  type AsaasWebhookEvent,
  type BillingCycle,
} from "@/lib/asaas/events";

function autorizado(request: Request): boolean {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!esperado) return false;

  const recebido = request.headers.get("asaas-access-token") ?? "";
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  // timingSafeEqual lança se os comprimentos diferirem — comparar antes.
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Única superfície que concede ou estende acesso. Server Actions gravam
 * identificadores e pending_plan; a promoção de plano e a validade vêm daqui.
 *
 * Política de status: 200 para tudo que não seja falha nossa. A entrega do
 * Asaas é at-least-once, mas 15 respostas não-2xx consecutivas PAUSAM a fila
 * — os eventos seguem sendo gerados e param de ser entregues até reativação
 * manual. Devolver erro para evento irrelevante congelaria o estado de
 * assinatura de toda a base, em silêncio.
 */
export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const evento = (await request.json().catch(() => null)) as AsaasWebhookEvent | null;
  if (!evento?.event) return NextResponse.json({ ok: true });

  const supabase = createAdminClient();

  // Checkout hospedado (cartão): o externalReference do checkout NÃO propaga
  // para a subscription/payment gerada (confirmado no sandbox e na doc do
  // Asaas) — CHECKOUT_PAID é o único evento onde ele sobrevive. Usamos para
  // gravar asaas_customer_id, e os eventos PAYMENT_* seguintes (que chegam
  // com externalReference null) casam pelo customer em vez disso.
  const link = checkoutLinkFromEvent(evento);
  if (link) {
    const { error } = await supabase
      .from("stores")
      .update({ asaas_customer_id: link.asaasCustomerId })
      .eq("id", link.storeId);
    if (error) {
      console.error(`[webhook asaas] falha ao vincular customer da loja ${link.storeId}:`, error);
      return NextResponse.json({ error: "Falha ao gravar." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const storeId = storeIdFromEvent(evento);

  const supabaseLoja = supabase.from("stores").select("id, billing_cycle, pending_plan");
  const { data: loja } = storeId
    ? await supabaseLoja.eq("id", storeId).maybeSingle()
    : await (async () => {
        // Sem externalReference (caminho de checkout hospedado): casa pelo
        // customer, gravado no bootstrapping do CHECKOUT_PAID acima.
        const customerId = customerIdFromEvent(evento);
        if (!customerId) return { data: null };
        return supabaseLoja.eq("asaas_customer_id", customerId).maybeSingle();
      })();

  // Loja inexistente é 200 de propósito: reenviar não faria a loja aparecer, e
  // insistir queimaria as 15 tentativas que pausam a fila.
  if (!loja) return NextResponse.json({ ok: true });

  const cycle = (loja.billing_cycle ?? "monthly") as BillingCycle;

  // Payload malformado (ex.: dueDate inválido) faz translateEvent lançar.
  // Não é falha nossa: é dado externo não processável, e a política é a mesma
  // de "evento não tratado" — 200 sem gravar, para não queimar uma das 15
  // tentativas que pausam a fila do Asaas.
  let mudanca;
  try {
    mudanca = translateEvent(evento, cycle, new Date());
  } catch (err) {
    console.error(`[webhook asaas] payload não processável para loja ${loja.id}:`, err);
    return NextResponse.json({ ok: true });
  }
  if (!mudanca) return NextResponse.json({ ok: true });

  const patch: Record<string, unknown> = {
    subscription_status: mudanca.subscriptionStatus,
    plan_expires_at: mudanca.planExpiresAt,
  };

  // Downgrade agendado vira o plano em vigor quando o ciclo novo é pago.
  if (mudanca.applyPendingPlan && loja.pending_plan) {
    patch.plan = loja.pending_plan;
    patch.pending_plan = null;
  }

  const { error } = await supabase.from("stores").update(patch).eq("id", loja.id);

  if (error) {
    // Único caso de 5xx: falha nossa, e queremos o reenvio.
    console.error(`[webhook asaas] falha ao gravar loja ${loja.id}:`, error);
    return NextResponse.json({ error: "Falha ao gravar." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
