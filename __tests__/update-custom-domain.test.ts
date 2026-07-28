import { describe, it, expect, vi, beforeEach } from "vitest";
import type { StoreSettings } from "@/lib/types";

const getUser = vi.fn();
const from = vi.fn();
const update = vi.fn();
const getCurrentStore = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve({ auth: { getUser }, from })),
}));

vi.mock("@/lib/server/store", () => ({
  getCurrentStore: () => getCurrentStore(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

function baseStore(overrides: Partial<StoreSettings> = {}): StoreSettings {
  return {
    id: "store-1",
    name: "Ateliê Mira",
    slug: "atelie-mira",
    plan: "pro",
    trialEndsAt: null,
    whatsapp: "5511999990000",
    accentColor: "#C9A96E",
    logoUrl: null,
    coverUrl: null,
    description: null,
    monogram: null,
    analyticsId: null,
    pixelId: null,
    messageTemplate: null,
    instagram: null,
    paymentMethods: [],
    deliveryMethods: [],
    customDomain: null,
    customDomainVerified: false,
    fontPairing: "padrao",
    backgroundPalette: "padrao",
    cornerStyle: "padrao",
    secondaryColor: null,
    gridDensity: "padrao",
    ...overrides,
  };
}

function formDataWith(domain: string) {
  const fd = new FormData();
  fd.set("customDomain", domain);
  return fd;
}

describe("updateCustomDomain", () => {
  beforeEach(() => {
    getUser.mockReset();
    from.mockReset();
    update.mockReset();
    getCurrentStore.mockReset();

    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    update.mockReturnValue({ eq: () => Promise.resolve({ error: null }) });
    from.mockReturnValue({ update });
  });

  it("bloqueia loja starter — plano não permite domínio próprio, custom_domain não é tocado", async () => {
    getCurrentStore.mockResolvedValue(baseStore({ plan: "starter", customDomain: null }));
    const { updateCustomDomain } = await import("../app/actions/store");

    const result = await updateCustomDomain(null, formDataWith("boutiquedaana.com.br"));

    expect(result).toEqual({
      error: "Domínio próprio disponível apenas no plano Pro. Fale conosco para liberar.",
    });
    expect(from).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("bloqueia loja free — mesmo comportamento do starter", async () => {
    getCurrentStore.mockResolvedValue(baseStore({ plan: "free", customDomain: null }));
    const { updateCustomDomain } = await import("../app/actions/store");

    const result = await updateCustomDomain(null, formDataWith("boutiquedaana.com.br"));

    expect(result).toEqual({
      error: "Domínio próprio disponível apenas no plano Pro. Fale conosco para liberar.",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("permite loja pro salvar domínio válido e zera custom_domain_verified", async () => {
    getCurrentStore.mockResolvedValue(baseStore({ plan: "pro", customDomain: null }));
    const { updateCustomDomain } = await import("../app/actions/store");

    const result = await updateCustomDomain(null, formDataWith("boutiquedaana.com.br"));

    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({
      custom_domain: "boutiquedaana.com.br",
      custom_domain_verified: false,
    });
  });

  it("rejeita domínio com protocolo/path — formato inválido", async () => {
    getCurrentStore.mockResolvedValue(baseStore({ plan: "pro", customDomain: null }));
    const { updateCustomDomain } = await import("../app/actions/store");

    const result = await updateCustomDomain(null, formDataWith("https://boutiquedaana.com.br/loja"));

    expect(result).toEqual({
      error: "Domínio inválido — use o formato exemplo.com.br, sem http:// e sem barras",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("mantém custom_domain_verified quando o domínio enviado é igual ao já salvo", async () => {
    getCurrentStore.mockResolvedValue(
      baseStore({ plan: "pro", customDomain: "boutiquedaana.com.br", customDomainVerified: true })
    );
    const { updateCustomDomain } = await import("../app/actions/store");

    const result = await updateCustomDomain(null, formDataWith("boutiquedaana.com.br"));

    expect(result).toEqual({ ok: true });
    // domínio não mudou -> não deve mandar custom_domain_verified no update (não reseta verificação manual)
    expect(update).toHaveBeenCalledWith({ custom_domain: "boutiquedaana.com.br" });
  });

  it("limpar o domínio (string vazia) zera custom_domain_verified", async () => {
    getCurrentStore.mockResolvedValue(
      baseStore({ plan: "pro", customDomain: "boutiquedaana.com.br", customDomainVerified: true })
    );
    const { updateCustomDomain } = await import("../app/actions/store");

    const result = await updateCustomDomain(null, formDataWith(""));

    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({ custom_domain: null, custom_domain_verified: false });
  });

  it("mapeia violação de unicidade (23505) para mensagem amigável", async () => {
    getCurrentStore.mockResolvedValue(baseStore({ plan: "pro", customDomain: null }));
    update.mockReturnValue({ eq: () => Promise.resolve({ error: { code: "23505" } }) });
    const { updateCustomDomain } = await import("../app/actions/store");

    const result = await updateCustomDomain(null, formDataWith("boutiquedaana.com.br"));

    expect(result).toEqual({ error: "Esse domínio já está em uso por outra loja." });
  });

  it("retorna erro genérico para outras falhas do Supabase", async () => {
    getCurrentStore.mockResolvedValue(baseStore({ plan: "pro", customDomain: null }));
    update.mockReturnValue({ eq: () => Promise.resolve({ error: { code: "OTHER" } }) });
    const { updateCustomDomain } = await import("../app/actions/store");

    const result = await updateCustomDomain(null, formDataWith("boutiquedaana.com.br"));

    expect(result).toEqual({ error: "Erro ao salvar o domínio." });
  });

  it("retorna erro quando não autenticado, sem chamar getCurrentStore", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { updateCustomDomain } = await import("../app/actions/store");

    const result = await updateCustomDomain(null, formDataWith("boutiquedaana.com.br"));

    expect(result).toEqual({ error: "Não autenticado." });
    expect(getCurrentStore).not.toHaveBeenCalled();
  });
});
