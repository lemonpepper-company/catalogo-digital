"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStore } from "@/lib/server/store";
import { getPlanLimits, isTrialActive } from "@/lib/plan-limits";
import { productSchema } from "@/lib/validation/painel";
import { parseReaisToCents } from "@/lib/utils";
import { uploadPhotos, publicUrlToPath } from "@/lib/server/upload";
import type { ProductColor } from "@/lib/types";

const BUCKET = "product-images";

export type ProductActionState = { error: string } | null;
export type ToggleActionState = { error: string } | { ok: true } | null;

function parseFormProduct(formData: FormData) {
  const priceCents = parseReaisToCents((formData.get("price") as string) ?? "");
  const stockRaw = parseInt((formData.get("stock") as string) ?? "0", 10);
  const categoryIdRaw = formData.get("categoryId");
  const categoryId =
    typeof categoryIdRaw === "string" && categoryIdRaw !== ""
      ? categoryIdRaw
      : null;

  const base = productSchema.safeParse({
    name: formData.get("name"),
    priceCents: Number.isNaN(priceCents) ? -1 : priceCents,
    stock: Number.isNaN(stockRaw) ? 0 : stockRaw,
    categoryId,
    description: (formData.get("description") as string) || null,
  });

  return base;
}

function jsonArray<T>(formData: FormData, key: string): T[] {
  try {
    const raw = formData.get(key);
    return typeof raw === "string" && raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

export async function createProduct(
  prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." };

  const parsed = parseFormProduct(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const limits = getPlanLimits(store.plan, isTrialActive(store.trialEndsAt));

  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("store_id", store.id);
  if ((count ?? 0) >= limits.maxProducts) {
    return {
      error: "Limite de produtos do plano Starter atingido. Faça upgrade para Pro.",
    };
  }

  const files = formData.getAll("photos") as File[];
  const realFiles = files.filter((f) => f && f.size > 0);
  if (realFiles.length > limits.maxPhotos) {
    return { error: `Seu plano permite no máximo ${limits.maxPhotos} fotos por produto.` };
  }

  let images: string[];
  try {
    images = await uploadPhotos(supabase, store.id, realFiles);
  } catch {
    return { error: "Falha no upload das fotos. Tente novamente." };
  }

  const { error } = await supabase.from("products").insert({
    store_id: store.id,
    name: parsed.data.name,
    price_cents: parsed.data.priceCents,
    description: parsed.data.description,
    category_id: parsed.data.categoryId,
    sizes: jsonArray<string>(formData, "sizes"),
    sold_sizes: jsonArray<string>(formData, "soldSizes"),
    colors: jsonArray<ProductColor>(formData, "colors"),
    images,
    stock: parsed.data.stock,
    is_active: formData.get("isActive") === "true",
    is_new: formData.get("isNew") === "true",
  });

  if (error) return { error: "Erro ao salvar o produto." };

  revalidatePath("/painel/produtos");
  redirect("/painel/produtos");
}

export async function updateProduct(
  prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const id = formData.get("id");
  if (typeof id !== "string") return { error: "Produto inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." };

  const parsed = parseFormProduct(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const limits = getPlanLimits(store.plan, isTrialActive(store.trialEndsAt));

  const { data: current } = await supabase
    .from("products")
    .select("images")
    .eq("id", id)
    .eq("store_id", store.id)
    .maybeSingle();
  if (!current) return { error: "Produto não encontrado." };

  const keptImages = jsonArray<string>(formData, "existing_images");
  const files = (formData.getAll("photos") as File[]).filter(
    (f) => f && f.size > 0
  );

  if (keptImages.length + files.length > limits.maxPhotos) {
    return { error: `Seu plano permite no máximo ${limits.maxPhotos} fotos por produto.` };
  }

  let uploaded: string[];
  try {
    uploaded = await uploadPhotos(supabase, store.id, files);
  } catch {
    return { error: "Falha no upload das fotos. Tente novamente." };
  }
  const images = [...keptImages, ...uploaded];

  const removed = (current.images as string[]).filter(
    (url) => !keptImages.includes(url)
  );
  if (removed.length > 0) {
    const paths = removed
      .map(publicUrlToPath)
      .filter((p): p is string => p !== null);
    if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths);
  }

  const { error } = await supabase
    .from("products")
    .update({
      name: parsed.data.name,
      price_cents: parsed.data.priceCents,
      description: parsed.data.description,
      category_id: parsed.data.categoryId,
      sizes: jsonArray<string>(formData, "sizes"),
      sold_sizes: jsonArray<string>(formData, "soldSizes"),
      colors: jsonArray<ProductColor>(formData, "colors"),
      images,
      stock: parsed.data.stock,
      is_active: formData.get("isActive") === "true",
      is_new: formData.get("isNew") === "true",
    })
    .eq("id", id)
    .eq("store_id", store.id);

  if (error) return { error: "Erro ao atualizar o produto." };

  revalidatePath("/painel/produtos");
  redirect("/painel/produtos");
}

export async function deleteProduct(
  prevState: ToggleActionState,
  formData: FormData
): Promise<ToggleActionState> {
  const id = formData.get("id");
  if (typeof id !== "string") return { error: "Produto inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." };

  const { data: current } = await supabase
    .from("products")
    .select("images")
    .eq("id", id)
    .eq("store_id", store.id)
    .maybeSingle();

  if (current?.images?.length) {
    const paths = (current.images as string[])
      .map(publicUrlToPath)
      .filter((p): p is string => p !== null);
    if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths);
  }

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)
    .eq("store_id", store.id);

  if (error) return { error: "Erro ao excluir o produto." };

  revalidatePath("/painel/produtos");
  return { ok: true };
}

export async function toggleProductActive(
  prevState: ToggleActionState,
  formData: FormData
): Promise<ToggleActionState> {
  const id = formData.get("id");
  const next = formData.get("isActive") === "true";
  if (typeof id !== "string") return { error: "Produto inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." };

  const { error } = await supabase
    .from("products")
    .update({ is_active: next })
    .eq("id", id)
    .eq("store_id", store.id);

  if (error) return { error: "Erro ao atualizar visibilidade." };

  revalidatePath("/painel/produtos");
  return { ok: true };
}
