import type { PlanLimits } from "@/lib/plan-limits";
import type { PublicCategoryRow, PublicProductRow } from "@/lib/catalog";

export interface VisibleCatalog {
  products: PublicProductRow[];
  categories: PublicCategoryRow[];
}

function takeFirst<T>(items: T[], max: number): T[] {
  return Number.isFinite(max) ? items.slice(0, max) : items;
}

/**
 * Recorta o catálogo pelo que o plano permite EXIBIR. Espelho de leitura dos
 * limites que as Server Actions já aplicam na escrita — é o que impede uma loja
 * rebaixada de continuar entregando vitrine premium.
 *
 * Pré-condição: `products` já vem na ordenação canônica (created_at desc,
 * id desc). PublicProductRow não carrega created_at, então esta função nunca
 * ordena: preserva a ordem recebida e corta.
 *
 * Nada é apagado — o corte é só de leitura e tudo reaparece no re-upgrade.
 */
export function applyPlanVisibility(
  products: PublicProductRow[],
  categories: PublicCategoryRow[],
  limits: PlanLimits
): VisibleCatalog {
  const visibleProducts = takeFirst(products, limits.maxProducts);

  // Categorias derivam dos produtos sobreviventes: cortar a lista de categorias
  // direto exibiria filtros que não retornam nada, o que lê como bug e não como
  // limite de plano.
  const usedCatIds = new Set(
    visibleProducts.map((p) => p.category_id).filter((id): id is string => !!id)
  );
  const visibleCategories = takeFirst(
    categories.filter((c) => usedCatIds.has(c.id)),
    limits.maxCategories
  );
  const visibleCatIds = new Set(visibleCategories.map((c) => c.id));

  let featuredLeft = limits.maxFeaturedProducts;
  const capped = visibleProducts.map((p) => {
    const keepFeatured = p.is_featured && featuredLeft > 0;
    if (keepFeatured) featuredLeft -= 1;
    return {
      ...p,
      images: p.images ? p.images.slice(0, limits.maxPhotos) : null,
      is_featured: keepFeatured,
      // Produto de categoria cortada cai em "Todos" — mapPublicProduct já trata
      // category_id nulo dessa forma.
      category_id:
        p.category_id && visibleCatIds.has(p.category_id) ? p.category_id : null,
    };
  });

  return { products: capped, categories: visibleCategories };
}
