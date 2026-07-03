import "server-only";
import { unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/supabase/server";
import {
  resolveCatalog,
  type PublicCatalog,
  type PublicStoreRow,
  type PublicProductRow,
  type PublicCategoryRow,
} from "@/lib/catalog";

const STORE_COLS =
  "id, name, slug, is_active, whatsapp, accent_color, logo_url, description, monogram, analytics_id, pixel_id, message_template";
const PRODUCT_COLS =
  "id, name, price_cents, description, category_id, sizes, sold_sizes, colors, images, stock, is_active, is_new";

async function fetchPublicCatalog(slug: string): Promise<PublicCatalog> {
  const supabase = createAnonClient();

  const { data: storeRow } = await supabase
    .from("stores")
    .select(STORE_COLS)
    .eq("slug", slug)
    .maybeSingle();

  if (!storeRow) return resolveCatalog(null, [], []);
  if (!(storeRow as PublicStoreRow).is_active) {
    return resolveCatalog(storeRow as PublicStoreRow, [], []);
  }

  const [{ data: productRows }, { data: categoryRows }] = await Promise.all([
    supabase
      .from("products")
      .select(PRODUCT_COLS)
      .eq("store_id", (storeRow as PublicStoreRow).id)
      .eq("is_active", true)
      .gt("stock", 0)
      .order("created_at", { ascending: false }),
    supabase
      .from("categories")
      .select("id, name, position")
      .eq("store_id", (storeRow as PublicStoreRow).id)
      .order("position", { ascending: true }),
  ]);

  return resolveCatalog(
    storeRow as PublicStoreRow,
    (productRows ?? []) as PublicProductRow[],
    (categoryRows ?? []) as PublicCategoryRow[]
  );
}

/** Resolve o catálogo público de uma loja pelo slug. RLS + filtros explícitos garantem apenas produtos visíveis. */
export async function getPublicCatalog(slug: string): Promise<PublicCatalog> {
  return unstable_cache(fetchPublicCatalog, [slug], {
    tags: [`catalog-${slug}`],
  })(slug);
}
