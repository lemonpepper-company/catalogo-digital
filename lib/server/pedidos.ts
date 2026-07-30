import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getTotalPages, clampPage } from "@/lib/pagination";
import { mapOrderRow, type OrderRow } from "@/lib/orders";
import { computeOrderMetrics, type OrderMetricRow, type OrderMetrics } from "@/lib/order-metrics";
import type { PeriodRange } from "@/lib/period-filter";
import type { StoreOrder } from "@/lib/types";

export const ORDERS_PAGE_SIZE = 20;

const ORDER_COLS =
  "id, code, created_at, customer_name, payment_method, delivery_method, delivery_address, items_count, total_cents, status, order_items(product_name, unit_price_cents, qty, size, color)";

/**
 * Busca por código **ou** nome do cliente, case-insensitive (ORD-35.10). Vírgula,
 * parênteses e `%`/`*`/`\`/`_` são descartados: o PostgREST usa vírgula para separar
 * os termos do `or` e parênteses para agrupá-los, e os curingas mudariam o LIKE —
 * nenhum deles faz sentido num código ou nome. O `_` entrou depois da validação do
 * ciclo 2: é curinga de exatamente 1 caractere no LIKE, então `h_0l52` casava com
 * `HS0L52` e a busca ficava mais larga do que o lojista pediu.
 */
function orderSearchTerm(query: string): string {
  return query.trim().replace(/[,()%*\\_]/g, "");
}

function searchFilter(term: string): string {
  return `code.ilike.%${term}%,customer_name.ilike.%${term}%`;
}

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

/**
 * Histórico da loja, 20 por página, mais recentes primeiro. RLS restringe à loja
 * do dono e o `.eq("store_id")` mantém o isolamento explícito também na busca.
 * A contagem usa o mesmo filtro (busca + período) da listagem — a paginação é
 * recalculada sobre o resultado filtrado (ORD-35.10, ORD-46). `range: null`
 * (padrão) = todo o histórico, sem filtro de data.
 */
export async function getStoreOrders(
  storeId: string,
  page: number,
  query = "",
  range: PeriodRange | null = null
): Promise<StoreOrdersPage> {
  const supabase = await createClient();
  const term = orderSearchTerm(query);

  let countQuery = supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId);
  if (term) countQuery = countQuery.or(searchFilter(term));
  if (range) {
    countQuery = countQuery
      .gte("created_at", range.from.toISOString())
      .lte("created_at", range.to.toISOString());
  }

  const { count, error: countError } = await countQuery;

  if (countError) fail(`getStoreOrders(${storeId}) — erro ao contar pedidos`, countError);

  const total = count ?? 0;
  const totalPages = getTotalPages(total, ORDERS_PAGE_SIZE);
  const currentPage = clampPage(page, totalPages);
  const from = (currentPage - 1) * ORDERS_PAGE_SIZE;

  let listQuery = supabase.from("orders").select(ORDER_COLS).eq("store_id", storeId);
  if (term) listQuery = listQuery.or(searchFilter(term));
  if (range) {
    listQuery = listQuery
      .gte("created_at", range.from.toISOString())
      .lte("created_at", range.to.toISOString());
  }

  const { data, error } = await listQuery
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

/**
 * Métricas de "Vendas pela vitrine" no período informado (fuso do lojista).
 * `range: null` = todo o histórico, sem filtro de data — inclusive na contagem
 * de pendentes, que passou a respeitar o período (ORD-46).
 */
export async function getOrderMetrics(
  storeId: string,
  range: PeriodRange | null
): Promise<OrderMetrics> {
  const supabase = await createClient();

  let periodQuery = supabase
    .from("orders")
    .select("status, total_cents")
    .eq("store_id", storeId);
  let pendingQuery = supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("status", "pendente");

  if (range) {
    periodQuery = periodQuery
      .gte("created_at", range.from.toISOString())
      .lte("created_at", range.to.toISOString());
    pendingQuery = pendingQuery
      .gte("created_at", range.from.toISOString())
      .lte("created_at", range.to.toISOString());
  }

  const [periodResult, pendingResult] = await Promise.all([periodQuery, pendingQuery]);

  if (periodResult.error)
    fail(`getOrderMetrics(${storeId}) — erro ao ler pedidos do período`, periodResult.error);
  if (pendingResult.error)
    fail(`getOrderMetrics(${storeId}) — erro ao contar pendentes`, pendingResult.error);

  return computeOrderMetrics(
    (periodResult.data ?? []) as OrderMetricRow[],
    pendingResult.count ?? 0
  );
}
