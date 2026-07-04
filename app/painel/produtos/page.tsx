import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStore, mapProduct } from "@/lib/server/store";
import { getPlanLimits, isTrialActive } from "@/lib/plan-limits";
import { PRODUCTS_PAGE_SIZE, getTotalPages, clampPage } from "@/lib/pagination";
import { ProdutosClient } from "./ProdutosClient";

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const store = await getCurrentStore();
  if (!store) redirect("/login");

  const supabase = await createClient();

  const [
    { count: total },
    { count: active },
    { count: soldOut },
    { count: inactive },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id),
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
  ]);

  const totalPages = getTotalPages(total ?? 0, PRODUCTS_PAGE_SIZE);
  const { page: pageParam } = await searchParams;
  const page = clampPage(Number(pageParam ?? "1"), totalPages);
  const from = (page - 1) * PRODUCTS_PAGE_SIZE;
  const to = from + PRODUCTS_PAGE_SIZE - 1;

  const { data } = await supabase
    .from("products")
    .select(
      "id, name, price_cents, description, category_id, sizes, sold_sizes, colors, images, stock, is_active, is_new"
    )
    .eq("store_id", store.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  const products = (data ?? []).map(mapProduct);
  const limits = getPlanLimits(store.plan, isTrialActive(store.trialEndsAt));

  return (
    <ProdutosClient
      products={products}
      maxProducts={limits.maxProducts}
      counts={{
        active: active ?? 0,
        soldOut: soldOut ?? 0,
        inactive: inactive ?? 0,
        total: total ?? 0,
      }}
      page={page}
      totalPages={totalPages}
    />
  );
}
