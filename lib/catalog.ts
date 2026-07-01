import { formatCents } from "@/lib/utils";
import type { Product, ProductColor, Store } from "@/lib/types";

// Placeholder neutro (cor linen) para produtos sem imagem. next/image aceita data URIs.
export const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='4'%20height='5'%3E%3Crect%20width='4'%20height='5'%20fill='%23EFEBE2'/%3E%3C/svg%3E";

export interface PublicStoreRow {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  whatsapp: string | null;
  accent_color: string | null;
  logo_url: string | null;
  description: string | null;
  monogram: string | null;
  analytics_id: string | null;
  pixel_id: string | null;
  message_template: string | null;
}

export interface PublicProductRow {
  id: string;
  name: string;
  price_cents: number;
  description: string | null;
  category_id: string | null;
  sizes: string[] | null;
  sold_sizes: string[] | null;
  colors: ProductColor[] | null;
  images: string[] | null;
  stock: number;
  is_active: boolean;
  is_new: boolean;
}

export interface PublicCategoryRow {
  id: string;
  name: string;
  position: number;
}

export type PublicCatalog =
  | { status: "not_found" }
  | { status: "hidden"; store: Store }
  | { status: "ok"; store: Store; products: Product[] };

export function initialsFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.slice(0, 2).map((w) => w[0]);
  return letters.join("").toUpperCase();
}

export function mapPublicStore(
  row: PublicStoreRow,
  categories: string[]
): Store {
  return {
    name: row.name,
    monogram: row.monogram?.trim() || initialsFromName(row.name),
    logoUrl: row.logo_url,
    whatsapp: row.whatsapp ?? "",
    categories,
    description: row.description ?? "",
    accentColor: row.accent_color ?? "#C9A96E",
    catalogUrl: row.slug,
    analyticsId: row.analytics_id ?? undefined,
    pixelId: row.pixel_id ?? undefined,
    messageTemplate: row.message_template,
  };
}

export function mapPublicProduct(
  row: PublicProductRow,
  categoryName: string | null
): Product {
  return {
    id: row.id,
    name: row.name,
    price: formatCents(row.price_cents),
    category: categoryName ?? "Todos",
    image: row.images?.[0] ?? PLACEHOLDER_IMAGE,
    images: row.images ?? [],
    desc: row.description ?? "",
    sizes: row.sizes ?? [],
    soldSizes: row.sold_sizes ?? [],
    colors: row.colors ?? [],
    isNew: row.is_new,
    stock: row.stock,
    active: row.is_active,
  };
}

// Pills: "Todos" fixo + categorias que têm ao menos um produto visível.
export function computePills(
  categoryRows: PublicCategoryRow[],
  productRows: PublicProductRow[]
): string[] {
  const usedCatIds = new Set(
    productRows.map((p) => p.category_id).filter((id): id is string => !!id)
  );
  const withProducts = categoryRows
    .filter((c) => usedCatIds.has(c.id))
    .map((c) => c.name);
  return ["Todos", ...withProducts];
}

// Decisão pura de visibilidade + montagem do catálogo. Sem I/O — testável direto.
export function resolveCatalog(
  storeRow: PublicStoreRow | null,
  productRows: PublicProductRow[],
  categoryRows: PublicCategoryRow[]
): PublicCatalog {
  if (!storeRow) return { status: "not_found" };
  if (!storeRow.is_active) {
    return { status: "hidden", store: mapPublicStore(storeRow, []) };
  }
  const nameById = new Map(categoryRows.map((c) => [c.id, c.name]));
  const products = productRows.map((p) =>
    mapPublicProduct(p, p.category_id ? nameById.get(p.category_id) ?? null : null)
  );
  const pills = computePills(categoryRows, productRows);
  return { status: "ok", store: mapPublicStore(storeRow, pills), products };
}
