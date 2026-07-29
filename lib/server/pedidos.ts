import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getTotalPages, clampPage } from "@/lib/pagination";
import { mapOrderRow, type OrderRow } from "@/lib/orders";
import {
  computeOrderMetrics,
  monthStartInSaoPaulo,
  type OrderMetricRow,
  type OrderMetrics,
} from "@/lib/order-metrics";
import type { StoreOrder } from "@/lib/types";

export const ORDERS_PAGE_SIZE = 20;

const ORDER_COLS =
  "id, created_at, customer_name, payment_method, delivery_method, delivery_address, items_count, total_cents, status, order_items(product_name, unit_price_cents, qty, size, color)";

export interface StoreOrdersPage {
  orders: StoreOrder[];
  total: number;
  page: number;
  totalPages: number;
}

// Erro de banco nunca vira lista vazia: um permission denied disfarçado de
// "loja sem pedidos" esconderia a falha (docs/CONVENTIONS.md → Supabase).
function fail(context: string, error: { message: string }): never {
  console.error(`${context}:`, error);
  throw new Error(`${context}: ${error.message}`);
}

/** Histórico da loja, 20 por página, mais recentes primeiro. RLS restringe à loja do dono. */
export async function getStoreOrders(
  storeId: string,
  page: number
): Promise<StoreOrdersPage> {
  const supabase = await createClient();

  const { count, error: countError } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId);

  if (countError) fail(`getStoreOrders(${storeId}) — erro ao contar pedidos`, countError);

  const total = count ?? 0;
  const totalPages = getTotalPages(total, ORDERS_PAGE_SIZE);
  const currentPage = clampPage(page, totalPages);
  const from = (currentPage - 1) * ORDERS_PAGE_SIZE;

  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_COLS)
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .range(from, from + ORDERS_PAGE_SIZE - 1);

  if (error) fail(`getStoreOrders(${storeId}) — erro ao listar pedidos`, error);

  return {
    orders: ((data ?? []) as unknown as OrderRow[]).map(mapOrderRow),
    total,
    page: currentPage,
    totalPages,
  };
}

/** Métricas de ROI do mês corrente (fuso do lojista) + pendentes de todo o histórico. */
export async function getOrderMetrics(
  storeId: string,
  now: Date = new Date()
): Promise<OrderMetrics> {
  const supabase = await createClient();
  const monthStart = monthStartInSaoPaulo(now).toISOString();

  const [monthResult, pendingResult] = await Promise.all([
    supabase
      .from("orders")
      .select("status, total_cents")
      .eq("store_id", storeId)
      .gte("created_at", monthStart),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("status", "pendente"),
  ]);

  if (monthResult.error)
    fail(`getOrderMetrics(${storeId}) — erro ao ler pedidos do mês`, monthResult.error);
  if (pendingResult.error)
    fail(`getOrderMetrics(${storeId}) — erro ao contar pendentes`, pendingResult.error);

  return computeOrderMetrics(
    (monthResult.data ?? []) as OrderMetricRow[],
    pendingResult.count ?? 0
  );
}
