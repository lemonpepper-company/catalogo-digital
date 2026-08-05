"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentStore } from "@/lib/server/store";
import { storeSettingsSchema, personalizacaoSchema, domainSchema } from "@/lib/validation/painel";
import { validarDocumento, normalizarDocumento } from "@/lib/validation/documento";
import { validarCep, normalizarCep } from "@/lib/validation/cep";
import { atualizarCliente } from "@/lib/asaas/subscriptions";
import { uploadToBucket, deleteFromBucket } from "@/lib/server/upload";
import { getPlanLimits } from "@/lib/plan-limits";
import {
  getFontPairing,
  getBackgroundPalette,
  getCornerStyle,
  DEFAULT_FONT_PAIRING_KEY,
  DEFAULT_BACKGROUND_PALETTE_KEY,
  DEFAULT_CORNER_STYLE_KEY,
} from "@/lib/theme-options";

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
    whatsapp: (formData.get("whatsapp") as string) || "",
    description: (formData.get("description") as string) || null,
    monogram: (formData.get("monogram") as string) || null,
    instagram: (formData.get("instagram") as string)?.replace(/^@+/, "").trim() || null,
    paymentMethods: JSON.parse((formData.get("paymentMethods") as string) || "[]"),
    deliveryMethods: JSON.parse((formData.get("deliveryMethods") as string) || "[]"),
    // analyticsId e pixelId não vêm do formData (UI oculta) — preserva valores existentes no banco
    analyticsId: store.analyticsId,
    pixelId: store.pixelId,
    messageTemplate: (formData.get("messageTemplate") as string) || null,
    document: (formData.get("document") as string) || null,
    postalCode: (formData.get("postalCode") as string) || null,
    addressNumber: (formData.get("addressNumber") as string) || null,
    address: (formData.get("address") as string) || null,
    addressProvince: (formData.get("addressProvince") as string) || null,
    addressCity: (formData.get("addressCity") as string) || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Opcional aqui (só é exigido na hora de assinar via Pix ou cartão) — mas
  // se preenchido, tem que ser um CPF/CNPJ válido, mesma regra da assinatura.
  let document: string | null = null;
  if (parsed.data.document) {
    if (!validarDocumento(parsed.data.document)) return { error: "CPF ou CNPJ inválido." };
    document = normalizarDocumento(parsed.data.document);
  }

  // CEP, número, rua, bairro e cidade andam juntos — ou os cinco, ou
  // nenhum. Rua/bairro/cidade eram resolvidos só pelo ViaCEP, mas nem todo
  // CEP devolve os três (CEPs de agrupamento, área rural, construção nova)
  // — o cliente ainda sugere os valores ao sair do campo CEP (ver
  // app/actions/cep.ts), mas quem decide o que é salvo é o formulário.
  let address: {
    address: string;
    addressNumber: string;
    addressProvince: string;
    addressCity: string;
    addressPostalCode: string;
  } | null = null;
  const camposEndereco = [
    parsed.data.postalCode,
    parsed.data.addressNumber,
    parsed.data.address,
    parsed.data.addressProvince,
    parsed.data.addressCity,
  ];
  const preenchidos = camposEndereco.filter((v) => !!v).length;
  if (preenchidos > 0 && preenchidos < camposEndereco.length) {
    return { error: "Preencha CEP, número, rua, bairro e cidade juntos, ou deixe todos em branco." };
  }
  if (preenchidos === camposEndereco.length) {
    if (!validarCep(parsed.data.postalCode!)) return { error: "CEP inválido." };
    address = {
      address: parsed.data.address!.trim(),
      addressNumber: parsed.data.addressNumber!.trim(),
      addressProvince: parsed.data.addressProvince!.trim(),
      addressCity: parsed.data.addressCity!.trim(),
      addressPostalCode: normalizarCep(parsed.data.postalCode!),
    };
  }

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
      description: parsed.data.description,
      monogram: parsed.data.monogram,
      instagram: parsed.data.instagram,
      payment_methods: parsed.data.paymentMethods,
      delivery_methods: parsed.data.deliveryMethods,
      analytics_id: parsed.data.analyticsId,
      pixel_id: parsed.data.pixelId,
      message_template: parsed.data.messageTemplate,
      logo_url: logoUrl,
      document,
      address: address?.address ?? null,
      address_number: address?.addressNumber ?? null,
      address_province: address?.addressProvince ?? null,
      address_city: address?.addressCity ?? null,
      address_postal_code: address?.addressPostalCode ?? null,
    })
    .eq("id", store.id);

  if (error) return { error: "Erro ao salvar as configurações." };

  // Remove o logo anterior do bucket quando foi substituído (evita órfãos).
  if (store.logoUrl && store.logoUrl !== logoUrl) {
    await deleteFromBucket(supabase, store.logoUrl);
  }

  // O customer no Asaas guarda uma cópia desses dados — sem sincronizar, uma
  // atualização feita aqui (ex: trocar o CEP) não se reflete lá, e a próxima
  // cobrança usa o endereço antigo. Só roda se já existe customer (a
  // sincronização na hora de assinar cobre quem ainda não tem um) e só com
  // documento presente, que o Asaas exige em qualquer PUT /customers.
  // Best-effort: falha aqui não deve derrubar o salvamento das configurações,
  // que já aconteceu com sucesso.
  if (store.asaasCustomerId && document) {
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (authUser?.email) {
        await atualizarCliente(store.asaasCustomerId, {
          name: parsed.data.name,
          cpfCnpj: document,
          email: authUser.email,
          phone: parsed.data.whatsapp.replace(/\D/g, ""),
          ...(address
            ? {
                address: address.address,
                addressNumber: address.addressNumber,
                province: address.addressProvince,
                city: address.addressCity,
                postalCode: address.addressPostalCode,
              }
            : {}),
        });
      }
    } catch (e) {
      console.error("[updateStoreSettings] falha ao sincronizar customer no Asaas:", e);
    }
  }

  revalidatePath("/painel/configuracoes");
  revalidatePath("/painel");
  revalidateTag(`catalog-${store.slug}`, { expire: 0 });
  return { ok: true };
}

export async function updatePersonalizacao(
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

  const limits = getPlanLimits(store.plan, store.planExpiresAt);

  const parsed = personalizacaoSchema.safeParse({
    accentColor: formData.get("accentColor"),
    fontPairing: (formData.get("fontPairing") as string) || DEFAULT_FONT_PAIRING_KEY,
    backgroundPalette: (formData.get("backgroundPalette") as string) || DEFAULT_BACKGROUND_PALETTE_KEY,
    cornerStyle: (formData.get("cornerStyle") as string) || DEFAULT_CORNER_STYLE_KEY,
    secondaryColor: (formData.get("secondaryColor") as string) || null,
    gridDensity: (formData.get("gridDensity") as string) || "padrao",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Revalida no servidor — a UI já bloqueia isso, mas a fonte de verdade é aqui.
  // Cada eixo é validado de forma independente.
  const fontPairing = limits.themeOptions
    ? getFontPairing(parsed.data.fontPairing).key
    : DEFAULT_FONT_PAIRING_KEY;
  const backgroundPalette = limits.themeOptions
    ? getBackgroundPalette(parsed.data.backgroundPalette).key
    : DEFAULT_BACKGROUND_PALETTE_KEY;
  const cornerStyle = limits.themeOptions
    ? getCornerStyle(parsed.data.cornerStyle).key
    : DEFAULT_CORNER_STYLE_KEY;
  const secondaryColor = parsed.data.secondaryColor;
  const gridDensity = limits.gridDensity ? parsed.data.gridDensity : "padrao";

  let coverUrl = store.coverUrl;
  const removeCover = formData.get("removeCover") === "1";
  const cover = formData.get("cover") as File | null;
  if (removeCover) {
    coverUrl = null;
  } else if (cover && cover.size > 0) {
    const ext = cover.name.split(".").pop() || "jpg";
    const path = `${store.id}/cover/${crypto.randomUUID()}.${ext}`;
    try {
      coverUrl = await uploadToBucket(supabase, path, cover);
    } catch {
      return { error: "Falha no upload da capa." };
    }
  }

  const { error } = await supabase
    .from("stores")
    .update({
      accent_color: parsed.data.accentColor,
      cover_url: coverUrl,
      font_pairing: fontPairing,
      background_palette: backgroundPalette,
      corner_style: cornerStyle,
      secondary_color: secondaryColor,
      grid_density: gridDensity,
    })
    .eq("id", store.id);

  if (error) return { error: "Erro ao salvar a personalização." };

  // Remove a capa anterior do bucket quando foi substituída ou removida.
  if (store.coverUrl && store.coverUrl !== coverUrl) {
    await deleteFromBucket(supabase, store.coverUrl);
  }

  revalidatePath("/painel/personalizacao");
  revalidatePath("/painel");
  revalidateTag(`catalog-${store.slug}`, { expire: 0 });
  return { ok: true };
}

export async function updateCustomDomain(
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

  const limits = getPlanLimits(store.plan, store.planExpiresAt);
  if (!limits.customDomain) {
    return { error: "Domínio próprio disponível apenas no plano Pro. Fale conosco para liberar." };
  }

  const raw = (formData.get("customDomain") as string) || "";
  const parsed = domainSchema.safeParse(raw === "" ? null : raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const nextDomain = parsed.data;
  // Qualquer mudança no domínio (incluindo remoção) zera a verificação — a
  // ativação real é sempre manual, feita por você direto no Supabase depois
  // de confirmar o DNS. Esta action NUNCA grava custom_domain_verified = true.
  const domainChanged = nextDomain !== store.customDomain;

  // custom_domain/custom_domain_verified saíram do grant de update de
  // authenticated (ver supabase/migrations/20260728110000_*) — a propriedade
  // da loja já foi confirmada acima via getCurrentStore() (RLS), então este
  // update roda com o client admin, restrito a este id específico.
  let error;
  try {
    const admin = createAdminClient();
    ({ error } = await admin
      .from("stores")
      .update({
        custom_domain: nextDomain,
        ...(domainChanged ? { custom_domain_verified: false } : {}),
      })
      .eq("id", store.id));
  } catch {
    return { error: "Erro ao salvar o domínio." };
  }

  if (error) {
    if (error.code === "23505") {
      return { error: "Esse domínio já está em uso por outra loja." };
    }
    return { error: "Erro ao salvar o domínio." };
  }

  revalidatePath("/painel/configuracoes");
  return { ok: true };
}
