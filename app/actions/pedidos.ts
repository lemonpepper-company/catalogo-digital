"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStore } from "@/lib/server/store";
import { getPlanLimits } from "@/lib/plan-limits";
import { orderPayloadSchema } from "@/lib/validation/pedido";
import { isOrderStatus, resolveOrderItems, sanitizeCustomerName } from "@/lib/orders";
import type { ProductPriceRow } from "@/lib/orders";

export type RegistrarPedidoResult = { ok: true } | { ok: false };

export type OrderStatusState = { error: string } | { ok: true } | null;

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Endpoint público de captura: não confia em nada do cliente (preço e total são
 * recalculados a partir de products.price_cents) e nunca lança — o checkout do
 * catálogo abre o WhatsApp independentemente do resultado (ORD-03). Não consulta
 * plano: o pedido é gravado em qualquer plano, inclusive Free (ORD-27).
 */
export async function registrarPedido(payload: unknown): Promise<RegistrarPedidoResult> {
  try {
    const parsed = orderPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      console.error("registrarPedido: payload inválido —", parsed.error.issues[0].message);
      return { ok: false };
    }

    const { slug, clientOrderId, customerName, payment, delivery, address, items } = parsed.data;
    const supabase = createAdminClient();

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (storeError) {
      console.error("registrarPedido: erro ao buscar a loja —", storeError.message);
      return { ok: false };
    }
    if (!store) {
      console.error("registrarPedido: loja inexistente ou inativa —", slug);
      return { ok: false };
    }

    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { count, error: countError } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id)
      .gte("created_at", windowStart);

    if (countError) {
      console.error("registrarPedido: erro ao contar pedidos recentes —", countError.message);
      return { ok: false };
    }
    if ((count ?? 0) >= RATE_LIMIT_MAX) {
      console.error("registrarPedido: teto de pedidos por minuto atingido —", store.id);
      return { ok: false };
    }

    const productIds = [...new Set(items.map((item) => item.productId))];
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, price_cents")
      .in("id", productIds)
      .eq("store_id", store.id)
      .eq("is_active", true);

    if (productsError) {
      console.error("registrarPedido: erro ao buscar produtos —", productsError.message);
      return { ok: false };
    }

    const requested = items.map((item) => ({
      productId: item.productId,
      size: item.size ?? null,
      color: item.color ?? null,
      qty: item.qty,
    }));
    const resolved = resolveOrderItems(requested, (products ?? []) as ProductPriceRow[]);

    if (resolved.items.length === 0) {
      console.error("registrarPedido: nenhum item resolvido —", slug);
      return { ok: false };
    }

    const { data: inserted, error: orderError } = await supabase
      .from("orders")
      .upsert(
        {
          store_id: store.id,
          client_order_id: clientOrderId,
          customer_name: sanitizeCustomerName(customerName),
          payment_method: payment ?? null,
          delivery_method: delivery ?? null,
          delivery_address: address ?? null,
          items_count: resolved.itemsCount,
          total_cents: resolved.totalCents,
          status: "pendente",
        },
        { onConflict: "store_id,client_order_id", ignoreDuplicates: true }
      )
      .select("id");

    if (orderError) {
      console.error("registrarPedido: erro ao gravar o pedido —", orderError.message);
      return { ok: false };
    }

    const orderId = inserted?.[0]?.id;
    // 0 linhas = client_order_id já gravado (ignoreDuplicates): sucesso sem
    // gravar de novo (ORD-04).
    if (!orderId) return { ok: true };

    const { error: itemsError } = await supabase.from("order_items").insert(
      resolved.items.map((item) => ({
        order_id: orderId,
        product_id: item.productId,
        product_name: item.productName,
        unit_price_cents: item.unitPriceCents,
        qty: item.qty,
        size: item.size,
        color: item.color,
      }))
    );

    if (itemsError) {
      console.error("registrarPedido: erro ao gravar os itens —", itemsError.message);
      await supabase.from("orders").delete().eq("id", orderId);
      return { ok: false };
    }

    return { ok: true };
  } catch (error) {
    console.error("registrarPedido: falha inesperada —", error);
    return { ok: false };
  }
}

/**
 * Muda o status de um pedido da própria loja. Só a coluna `status` é escrita —
 * itens e valores do pedido são registro histórico. O gate de plano vive aqui
 * porque a action é a fronteira real, não a UI (ORD-28).
 */
export async function updateOrderStatus(
  prevState: OrderStatusState,
  formData: FormData
): Promise<OrderStatusState> {
  const id = formData.get("id");
  const status = formData.get("status");

  if (typeof id !== "string" || id === "") return { error: "Pedido inválido." };
  if (!isOrderStatus(status)) return { error: "Status inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." };

  if (!getPlanLimits(store.plan, store.trialEndsAt).hasOrderHistory) {
    return { error: "Histórico de pedidos disponível a partir do plano Starter." };
  }

  const { data, error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", id)
    .eq("store_id", store.id)
    .select("id");

  if (error) return { error: "Erro ao atualizar o status do pedido." };
  if (!data || data.length === 0) return { error: "Pedido não encontrado." };

  revalidatePath("/painel/pedidos");
  revalidatePath("/painel");
  return { ok: true };
}
