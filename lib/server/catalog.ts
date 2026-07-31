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
import type { Plan } from "@/lib/plan-limits";

const STORE_COLS =
  "id, name, slug, is_active, whatsapp, accent_color, cover_url, logo_url, description, monogram, analytics_id, pixel_id, message_template, instagram, payment_methods, delivery_methods, font_pairing, background_palette, corner_style, secondary_color, grid_density";
const PRODUCT_COLS =
  "id, name, price_cents, description, category_id, sizes, sold_sizes, colors, images, stock, is_active, is_new, is_featured";

type RawCatalogData = {
  storeRow: PublicStoreRow | null;
  productRows: PublicProductRow[];
  categoryRows: PublicCategoryRow[];
};

// Busca crua de stores/products/categories — SEM RPC de plano e SEM lógica de
// plano. Cacheada indefinidamente (invalidada pelos revalidateTag existentes
// em app/actions/produtos.ts, categorias.ts, store.ts e
// app/api/admin/revalidate/route.ts nas escritas dessas linhas). O plano
// efetivo NUNCA pode entrar aqui: rebaixamento de plano/expiração de trial
// não têm hook de invalidação próprio, então cachear o plano junto faria a
// vitrine continuar servindo o catálogo antigo até uma edição não relacionada
// de produto/categoria/loja disparar o revalidateTag por acidente.
async function fetchRawCatalogData(slug: string): Promise<RawCatalogData> {
  const supabase = createAnonClient();

  const { data: storeRow, error } = await supabase
    .from("stores")
    .select(STORE_COLS)
    .eq("slug", slug)
    .maybeSingle();

  // Distingue linha inexistente (data/error null → not_found legítimo) de erro
  // real de banco (ex.: permission denied em coluna). Não mascarar o segundo
  // como 404 — logar e propagar para virar 500 + rastro no servidor.
  if (error) {
    console.error(`fetchRawCatalogData(${slug}) — erro no SELECT de stores:`, error);
    throw new Error(`Falha ao buscar catálogo público: ${error.message}`);
  }

  if (!storeRow) return { storeRow: null, productRows: [], categoryRows: [] };

  if (!(storeRow as PublicStoreRow).is_active) {
    return { storeRow: storeRow as PublicStoreRow, productRows: [], categoryRows: [] };
  }

  const [{ data: productRows }, { data: categoryRows }] = await Promise.all([
    supabase
      .from("products")
      .select(PRODUCT_COLS)
      .eq("store_id", (storeRow as PublicStoreRow).id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false }),
    supabase
      .from("categories")
      .select("id, name, position")
      .eq("store_id", (storeRow as PublicStoreRow).id)
      .order("position", { ascending: true }),
  ]);

  return {
    storeRow: storeRow as PublicStoreRow,
    productRows: (productRows ?? []) as PublicProductRow[],
    categoryRows: (categoryRows ?? []) as PublicCategoryRow[],
  };
}

/** Resolve o catálogo público de uma loja pelo slug. RLS + filtros explícitos garantem apenas produtos visíveis. */
export async function getPublicCatalog(slug: string): Promise<PublicCatalog> {
  const { storeRow, productRows, categoryRows } = await unstable_cache(
    fetchRawCatalogData,
    [slug],
    { tags: [`catalog-${slug}`] }
  )(slug);

  if (!storeRow) return resolveCatalog(null, [], [], "free");

  // Resolução do plano efetivo roda FORA do cache, em toda requisição: é o
  // que faz o rebaixamento de plano (ou expiração de trial) valer na
  // próxima visita à vitrine, sem depender de o lojista editar produto,
  // categoria ou loja para acionar um revalidateTag e limpar o cache.
  const supabase = createAnonClient();
  const { data: effectivePlan, error: planError } = await supabase.rpc("get_effective_plan", {
    p_store_id: storeRow.id,
  });
  if (planError) {
    console.error(`getPublicCatalog(${slug}) — erro ao resolver plano efetivo:`, planError);
    throw new Error(`Falha ao buscar catálogo público: ${planError.message}`);
  }
  const plan = (effectivePlan ?? "free") as Plan;

  return resolveCatalog(storeRow, productRows, categoryRows, plan);
}
