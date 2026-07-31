import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStore, mapProduct } from "@/lib/server/store";
import { getPlanLimits } from "@/lib/plan-limits";
import { PRODUCTS_PAGE_SIZE, getTotalPages, clampPage } from "@/lib/pagination";
import {
  NO_CATEGORY_VALUE,
  isValidStatus,
  isValidCategoria,
  type ProductStatusFilter,
} from "@/lib/product-filters";
import { ProdutosClient } from "./ProdutosClient";

function applyProductFilters(
  query: any,
  q: string | undefined,
  categoria: string | undefined,
  status: ProductStatusFilter | undefined
) {
  let result = query;
  if (q) result = result.ilike("name", `%${q}%`);
  if (categoria === NO_CATEGORY_VALUE) result = result.is("category_id", null);
  else if (categoria) result = result.eq("category_id", categoria);
  if (status === "ativo") result = result.eq("is_active", true).gt("stock", 0);
  else if (status === "esgotado") result = result.eq("stock", 0);
  else if (status === "inativo") result = result.eq("is_active", false);
  return result;
}

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    categoria?: string;
    status?: string;
  }>;
}) {
  const store = await getCurrentStore();
  if (!store) redirect("/login");
  const limits = getPlanLimits(store.plan, store.trialEndsAt);

  const supabase = await createClient();
  const { page: pageParam, q, categoria, status } = await searchParams;

  const { data: categoryRows } = await supabase
    .from("categories")
    .select("id, name")
    .eq("store_id", store.id)
    .order("position", { ascending: true });
  const categories = categoryRows ?? [];

  const validCategoria = isValidCategoria(categoria, categories)
    ? categoria
    : undefined;
  const validStatus = isValidStatus(status) ? status : undefined;

  const [
    { count: total },
    { count: active },
    { count: soldOut },
    { count: inactive },
    { count: storeTotal },
  ] = await Promise.all([
    applyProductFilters(
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("store_id", store.id),
      q,
      validCategoria,
      validStatus
    ),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id)
      .eq("is_active", true)
      .gt("stock", 0),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id)
      .eq("stock", 0),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id)
      .eq("is_active", false),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id),
  ]);

  const totalPages = getTotalPages(total ?? 0, PRODUCTS_PAGE_SIZE);
  const page = clampPage(Number(pageParam ?? "1"), totalPages);
  const from = (page - 1) * PRODUCTS_PAGE_SIZE;
  const to = from + PRODUCTS_PAGE_SIZE - 1;

  const { data } = await applyProductFilters(
    supabase
      .from("products")
      .select(
        "id, name, price_cents, description, category_id, sizes, sold_sizes, colors, images, stock, is_active, is_new, is_featured"
      )
      .eq("store_id", store.id),
    q,
    validCategoria,
    validStatus
  )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  const products = (data ?? []).map(mapProduct);

  // A vitrine exibe apenas is_active = true (lib/server/catalog.ts), então o
  // truncamento incide só sobre ativos. `active` não serve aqui: ele é
  // is_active AND stock > 0, e a vitrine exibe esgotados.
  const activeOnVitrine = (storeTotal ?? 0) - (inactive ?? 0);
  const hiddenCount = Number.isFinite(limits.maxProducts)
    ? Math.max(0, activeOnVitrine - limits.maxProducts)
    : 0;

  let visibleIds: string[] = [];
  if (hiddenCount > 0) {
    // Mesma ordenação e mesmo filtro da vitrine — sem isso o painel marcaria
    // como oculto um produto que a vitrine está exibindo.
    const { data: visibleRows } = await supabase
      .from("products")
      .select("id")
      .eq("store_id", store.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limits.maxProducts);
    visibleIds = (visibleRows ?? []).map((r) => r.id);
  }

  return (
    <ProdutosClient
      products={products}
      maxProducts={limits.maxProducts}
      limits={limits}
      hiddenCount={hiddenCount}
      visibleIds={visibleIds}
      counts={{
        active: active ?? 0,
        soldOut: soldOut ?? 0,
        inactive: inactive ?? 0,
        total: storeTotal ?? 0,
      }}
      page={page}
      totalPages={totalPages}
      categories={categories}
      initialQ={q ?? ""}
      initialCategoria={validCategoria ?? ""}
      initialStatus={validStatus ?? ""}
    />
  );
}
