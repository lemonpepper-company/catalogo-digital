"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getPlanLimits, type Plan } from "@/lib/plan-limits";
import { eventPayloadSchema } from "@/lib/validation/evento";

export type RegistrarEventoResult = { ok: true } | { ok: false };

/**
 * Endpoint público de telemetria do catálogo. Espelha `registrarPedido`: valida
 * tudo, escreve só via service role e **nunca lança** — o disparo é
 * fire-and-forget e a navegação/venda jamais espera por ele (ANL-07).
 *
 * Grava apenas quando o plano efetivo da loja tem `hasAnalytics` — hoje, só o Pro
 * (APO-01/APO-02, AD-014). O plano vem da mesma consulta que já resolve a loja pelo
 * slug, então o gate não custa round-trip (APO-06). Supersede ANL-09, que gravava
 * em qualquer plano.
 *
 * Sem rate-limit por decisão registrada (AD-013): o dano de abuso aqui é cosmético.
 * Quando o gatilho disparar, copiar a contagem por janela de `registrarPedido`.
 */
export async function registrarEvento(payload: unknown): Promise<RegistrarEventoResult> {
  try {
    const parsed = eventPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      console.error("registrarEvento: payload inválido —", parsed.error.issues[0].message);
      return { ok: false };
    }

    const { slug, visitorId, eventType, productId } = parsed.data;
    const supabase = createAdminClient();

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, plan, plan_expires_at")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (storeError) {
      console.error("registrarEvento: erro ao buscar a loja —", storeError.message);
      return { ok: false };
    }
    if (!store) {
      console.error("registrarEvento: loja inexistente ou inativa —", slug);
      return { ok: false };
    }

    // Loja sem o recurso não gera evento nenhum. Recusa silenciosa de propósito:
    // é o caminho esperado da maioria das lojas, e um console.error aqui viraria
    // uma linha de log por visita de vitrine Free (APO-04).
    if (!getPlanLimits(store.plan as Plan, store.plan_expires_at as string | null).hasAnalytics) {
      return { ok: false };
    }

    if (productId) {
      // Confere apenas a posse (store_id), não `is_active`: ver de um produto
      // recém-desativado é uma interação real e deve ser registrada.
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("id")
        .eq("id", productId)
        .eq("store_id", store.id)
        .maybeSingle();

      if (productError) {
        console.error("registrarEvento: erro ao buscar o produto —", productError.message);
        return { ok: false };
      }
      if (!product) {
        console.error("registrarEvento: produto fora da loja —", productId);
        return { ok: false };
      }
    }

    const { error: insertError } = await supabase.from("catalog_events").insert({
      store_id: store.id,
      event_type: eventType,
      product_id: productId ?? null,
      visitor_id: visitorId,
    });

    if (insertError) {
      console.error("registrarEvento: erro ao gravar o evento —", insertError.message);
      return { ok: false };
    }

    return { ok: true };
  } catch (error) {
    console.error("registrarEvento: falha inesperada —", error);
    return { ok: false };
  }
}
