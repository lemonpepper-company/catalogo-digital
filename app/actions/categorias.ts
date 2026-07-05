"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStore } from "@/lib/server/store";
import { getPlanLimits, isTrialActive } from "@/lib/plan-limits";
import { categoryNameSchema, canDeleteCategory } from "@/lib/validation/painel";

export type CategoryActionState =
  | { error: string }
  | { ok: true; id?: string }
  | null;

export async function createCategory(
  prevState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const parsed = categoryNameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." };

  const { count } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("store_id", store.id);

  const limits = getPlanLimits(store.plan, isTrialActive(store.trialEndsAt));
  if ((count ?? 0) >= limits.maxCategories) {
    return {
      error: "Limite de categorias do plano Starter atingido. Faça upgrade para Pro.",
    };
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({ store_id: store.id, name: parsed.data })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "Essa categoria já existe." };
    return { error: "Erro ao criar categoria." };
  }

  revalidatePath("/painel/categorias");
  updateTag(`catalog-${store.slug}`);
  return { ok: true, id: data.id };
}

export async function renameCategory(
  prevState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const id = formData.get("id");
  const parsed = categoryNameSchema.safeParse(formData.get("name"));
  if (typeof id !== "string") return { error: "Categoria inválida." };
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." };

  const { error } = await supabase
    .from("categories")
    .update({ name: parsed.data })
    .eq("id", id)
    .eq("store_id", store.id);

  if (error) {
    if (error.code === "23505") return { error: "Essa categoria já existe." };
    return { error: "Erro ao renomear categoria." };
  }

  revalidatePath("/painel/categorias");
  updateTag(`catalog-${store.slug}`);
  return { ok: true };
}

export async function deleteCategory(
  prevState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const id = formData.get("id");
  if (typeof id !== "string") return { error: "Categoria inválida." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." };

  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("store_id", store.id)
    .eq("category_id", id);

  if (!canDeleteCategory(count ?? 0)) {
    return {
      error: "Não é possível excluir uma categoria com produtos vinculados.",
    };
  }

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("store_id", store.id);

  if (error) return { error: "Erro ao excluir categoria." };

  revalidatePath("/painel/categorias");
  updateTag(`catalog-${store.slug}`);
  return { ok: true };
}
