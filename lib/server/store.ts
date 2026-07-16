import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  StoreSettings,
  StoreProduct,
  StoreCategory,
  ProductColor,
} from "@/lib/types";

type StoreRow = {
  id: string;
  name: string;
  slug: string;
  plan: "starter" | "pro" | null;
  trial_ends_at: string | null;
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
};

export function mapStore(row: StoreRow): StoreSettings {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    plan: row.plan,
    trialEndsAt: row.trial_ends_at,
    whatsapp: row.whatsapp,
    accentColor: row.accent_color ?? "#C9A96E",
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
      "id, name, slug, plan, trial_ends_at, whatsapp, accent_color, cover_url, logo_url, description, monogram, analytics_id, pixel_id, message_template, instagram, payment_methods, delivery_methods"
    )
    .eq("owner_id", user.id)
    .maybeSingle();

  return data ? mapStore(data as StoreRow) : null;
});

export type { StoreCategory };
