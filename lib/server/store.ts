import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_ACCENT_COLOR } from "@/lib/theme";
import type {
  StoreSettings,
  StoreProduct,
  StoreCategory,
  ProductColor,
  Plan,
} from "@/lib/types";

type StoreRow = {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
  plan_expires_at: string | null;
  whatsapp: string | null;
  accent_color: string | null;
  logo_url: string | null;
  cover_url: string | null;
  description: string | null;
  monogram: string | null;
  analytics_id: string | null;
  pixel_id: string | null;
  message_template: string | null;
  instagram: string | null;
  payment_methods: string[] | null;
  delivery_methods: string[] | null;
  custom_domain: string | null;
  custom_domain_verified: boolean;
  font_pairing: string;
  background_palette: string;
  corner_style: string;
  secondary_color: string | null;
  grid_density: string;
  document: string | null;
};

type ProductRow = {
  id: string;
  name: string;
  price_cents: number;
  description: string | null;
  category_id: string | null;
  sizes: string[];
  sold_sizes: string[];
  colors: ProductColor[];
  images: string[];
  stock: number;
  is_active: boolean;
  is_new: boolean;
  is_featured: boolean;
};

export function mapStore(row: StoreRow): StoreSettings {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    plan: row.plan,
    planExpiresAt: row.plan_expires_at,
    whatsapp: row.whatsapp,
    accentColor: row.accent_color ?? DEFAULT_ACCENT_COLOR,
    logoUrl: row.logo_url,
    coverUrl: row.cover_url,
    description: row.description,
    monogram: row.monogram,
    analyticsId: row.analytics_id,
    pixelId: row.pixel_id,
    messageTemplate: row.message_template,
    instagram: row.instagram,
    paymentMethods: row.payment_methods ?? [],
    deliveryMethods: row.delivery_methods ?? [],
    customDomain: row.custom_domain,
    customDomainVerified: row.custom_domain_verified,
    fontPairing: row.font_pairing,
    backgroundPalette: row.background_palette,
    cornerStyle: row.corner_style,
    secondaryColor: row.secondary_color,
    gridDensity: row.grid_density === "compacto" ? "compacto" : "padrao",
    document: row.document,
  };
}

export function mapProduct(row: ProductRow): StoreProduct {
  return {
    id: row.id,
    name: row.name,
    priceCents: row.price_cents,
    description: row.description,
    categoryId: row.category_id,
    sizes: row.sizes ?? [],
    soldSizes: row.sold_sizes ?? [],
    colors: row.colors ?? [],
    images: row.images ?? [],
    stock: row.stock,
    isActive: row.is_active,
    isNew: row.is_new,
    isFeatured: row.is_featured,
  };
}

/** Resolve a loja do usuário logado. Borda de segurança — o middleware já garante loja+plano. */
export const getCurrentStore = cache(async (): Promise<StoreSettings | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("stores")
    .select(
      "id, name, slug, plan, plan_expires_at, whatsapp, accent_color, cover_url, logo_url, description, monogram, analytics_id, pixel_id, message_template, instagram, payment_methods, delivery_methods, custom_domain, custom_domain_verified, font_pairing, background_palette, corner_style, secondary_color, grid_density, document"
    )
    .eq("owner_id", user.id)
    .maybeSingle();

  return data ? mapStore(data as StoreRow) : null;
});

export type { StoreCategory };
