"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStore } from "@/lib/server/store";
import { storeSettingsSchema } from "@/lib/validation/painel";
import { uploadToBucket } from "@/lib/server/upload";

export type StoreActionState = { error: string } | { ok: true } | null;

export async function updateStoreSettings(
  prevState: StoreActionState,
  formData: FormData
): Promise<StoreActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." };

  const parsed = storeSettingsSchema.safeParse({
    name: formData.get("name"),
    whatsapp: (formData.get("whatsapp") as string) || null,
    accentColor: formData.get("accentColor"),
    description: (formData.get("description") as string) || null,
    monogram: (formData.get("monogram") as string) || null,
    // analyticsId e pixelId não vêm do formData (UI oculta) — preserva valores existentes no banco
    analyticsId: store.analyticsId,
    pixelId: store.pixelId,
    messageTemplate: (formData.get("messageTemplate") as string) || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let logoUrl = store.logoUrl;
  const logo = formData.get("logo") as File | null;
  if (logo && logo.size > 0) {
    const ext = logo.name.split(".").pop() || "png";
    const path = `${store.id}/logo/${crypto.randomUUID()}.${ext}`;
    try {
      logoUrl = await uploadToBucket(supabase, path, logo);
    } catch {
      return { error: "Falha no upload do logo." };
    }
  }

  const { error } = await supabase
    .from("stores")
    .update({
      name: parsed.data.name,
      whatsapp: parsed.data.whatsapp,
      accent_color: parsed.data.accentColor,
      description: parsed.data.description,
      monogram: parsed.data.monogram,
      analytics_id: parsed.data.analyticsId,
      pixel_id: parsed.data.pixelId,
      message_template: parsed.data.messageTemplate,
      logo_url: logoUrl,
    })
    .eq("id", store.id);

  if (error) return { error: "Erro ao salvar as configurações." };

  revalidatePath("/painel/configuracoes");
  revalidatePath("/painel");
  return { ok: true };
}
