import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStore, mapProduct } from "@/lib/server/store";
import type { StoreCategory } from "@/lib/types";
import { ProdutoFormClient } from "../ProdutoFormClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditarProdutoPage({ params }: Props) {
  const { id } = await params;
  const store = await getCurrentStore();
  if (!store) redirect("/login");

  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select(
      "id, name, price_cents, description, category_id, sizes, sold_sizes, colors, images, stock, is_active, is_new"
    )
    .eq("id", id)
    .eq("store_id", store.id)
    .maybeSingle();

  if (!product) notFound();

  const { data: cats } = await supabase
    .from("categories")
    .select("id, name, position")
    .eq("store_id", store.id)
    .order("position", { ascending: true });

  const categories: StoreCategory[] = (cats ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    position: c.position,
    productCount: 0,
  }));

  return (
    <ProdutoFormClient product={mapProduct(product)} categories={categories} />
  );
}
