"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStore } from "@/lib/server/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  criarCliente,
  criarCheckoutCartao,
  criarAssinaturaPix,
  atualizarAssinatura,
  cancelarAssinatura as cancelarNoAsaas,
  criarCobrancaAvulsa,
} from "@/lib/asaas/subscriptions";
import { proporcional, type PaidPlan } from "@/lib/asaas/plans";
import type { BillingCycle } from "@/lib/asaas/events";
import { validarDocumento, normalizarDocumento } from "@/lib/validation/documento";

export type AssinaturaState =
  | { error: string }
  // redirectUrl: cartão — sai do site, checkout hospedado do Asaas.
  // pixUrl: Pix — fica no site, é o link da cobrança pra pagar (não navega
  // sozinho, quem decide mostrar é o client).
  | { ok: true; redirectUrl?: string; pixUrl?: string }
  | null;

export type MeioPagamento = "CREDIT_CARD" | "PIX";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function amanha(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

/**
 * Cria a assinatura no Asaas e guarda apenas identificadores. `plan` e
 * `plan_expires_at` continuam intocados — quem concede acesso é o webhook,
 * quando o pagamento confirmar.
 */
export async function iniciarAssinatura(
  plan: PaidPlan,
  cycle: BillingCycle,
  meio: MeioPagamento
): Promise<AssinaturaState> {
  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." };

  const supabase = createAdminClient();

  try {
    if (meio === "CREDIT_CARD") {
      const checkout = await criarCheckoutCartao({
        plan,
        cycle,
        storeId: store.id,
        primeiroVencimento: amanha(),
        successUrl: `${siteUrl()}/painel/assinatura?status=ok`,
        cancelUrl: `${siteUrl()}/painel/assinatura?status=cancelado`,
        expiredUrl: `${siteUrl()}/painel/assinatura?status=expirado`,
      });

      // pending_plan é o único jeito do webhook saber para qual plano promover
      // quando PAYMENT_CONFIRMED chegar — sem isso a primeira assinatura nunca
      // sai do Free, mesmo com o pagamento confirmado (mesma semântica do
      // downgrade: "plano a aplicar na próxima confirmação").
      await supabase
        .from("stores")
        .update({ billing_cycle: cycle, pending_plan: plan })
        .eq("id", store.id);
      return { ok: true, redirectUrl: checkout.link };
    }

    // Pix não é aceito em chargeTypes RECURRENT (400 no sandbox), então a
    // assinatura é criada direto e o Asaas gera uma cobrança por ciclo.
    // POST /v3/customers exige cpfCnpj — sem documento, devolve o código de
    // controle que a Task 7 usa para abrir a modal de coleta.
    if (!store.document) return { error: "DOCUMENTO_NECESSARIO" };

    const customerId =
      store.asaasCustomerId ??
      (
        await criarCliente({
          name: store.name,
          cpfCnpj: store.document,
          email: "",
          externalReference: store.id,
        })
      ).id;

    const assinatura = await criarAssinaturaPix({
      customerId,
      plan,
      cycle,
      storeId: store.id,
      primeiroVencimento: amanha(),
    });

    await supabase
      .from("stores")
      .update({
        asaas_customer_id: customerId,
        asaas_subscription_id: assinatura.id,
        billing_cycle: cycle,
        pending_plan: plan,
      })
      .eq("id", store.id);

    revalidatePath("/painel/assinatura");
    return { ok: true, pixUrl: assinatura.invoiceUrl ?? undefined };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao iniciar a assinatura." };
  }
}

/**
 * Upgrade cobra a diferença proporcional e downgrade não cobra nada — mas os
 * dois só agendam via pending_plan. NUNCA gravam plan diretamente: a
 * promoção vem sempre do webhook, quando a cobrança (avulsa ou do ciclo)
 * confirmar. Sem pending_plan no upgrade, o PAYMENT_CONFIRMED da cobrança
 * avulsa não teria para qual plano promover — o lojista pagaria a diferença
 * e nunca sairia do plano antigo (mesmo bug que a Task 9 achou em
 * iniciarAssinatura, aqui no caminho de troca de plano).
 */
export async function trocarPlano(destino: PaidPlan): Promise<AssinaturaState> {
  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." };
  if (!store.asaasSubscriptionId) return { error: "Nenhuma assinatura ativa." };

  const cycle = (store.billingCycle ?? "monthly") as BillingCycle;
  const supabase = createAdminClient();

  try {
    await atualizarAssinatura({ subscriptionId: store.asaasSubscriptionId, plan: destino, cycle });

    const valor =
      store.plan === "free"
        ? 0
        : proporcional(store.plan as PaidPlan, destino, cycle, store.planExpiresAt ?? "", new Date());

    await supabase.from("stores").update({ pending_plan: destino }).eq("id", store.id);

    if (valor > 0) {
      await criarCobrancaAvulsa({
        customerId: store.asaasCustomerId!,
        valor,
        storeId: store.id,
        vencimento: amanha(),
        descricao: `Upgrade para ${destino} — diferença proporcional`,
      });
    }

    revalidatePath("/painel/assinatura");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao trocar de plano." };
  }
}

/**
 * Única escrita síncrona de estado — e ela só RESTRINGE. `plan_expires_at` fica
 * intacto: o lojista usa até o fim do período que pagou.
 */
export async function cancelarAssinatura(): Promise<AssinaturaState> {
  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." };
  if (!store.asaasSubscriptionId) return { error: "Nenhuma assinatura ativa." };

  try {
    await cancelarNoAsaas(store.asaasSubscriptionId);
    const supabase = createAdminClient();
    await supabase
      .from("stores")
      .update({ subscription_status: "canceled" })
      .eq("id", store.id);
    revalidatePath("/painel/assinatura");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao cancelar." };
  }
}

/**
 * Coletado pela modal quando o lojista tenta assinar via Pix sem documento.
 * Validado aqui antes de qualquer ida ao Asaas: dígito verificador errado é
 * diagnóstico nosso, e repassar a mensagem crua do gateway seria pior. Roda
 * com o client autenticado, não a service role: `document` é dado da própria
 * loja e `authenticated` já tem grant nela, então a RLS "own store only" é a
 * fronteira correta.
 */
export async function salvarDocumento(valor: string): Promise<AssinaturaState> {
  if (!validarDocumento(valor)) return { error: "CPF ou CNPJ inválido." };

  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("stores")
    .update({ document: normalizarDocumento(valor) })
    .eq("id", store.id);

  if (error) return { error: "Não foi possível salvar o documento." };

  revalidatePath("/painel/assinatura");
  return { ok: true };
}
