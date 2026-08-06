import { describe, it, expect, vi, beforeEach } from "vitest";
import type { StoreSettings } from "@/lib/types";

const getUser = vi.fn();
const update = vi.fn();
const from = vi.fn();
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
    planExpiresAt: null,
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
    document: null,
    address: null,
    addressNumber: null,
    addressProvince: null,
    addressCity: null,
    addressPostalCode: null,
    asaasCustomerId: null,
    asaasSubscriptionId: null,
    billingCycle: null,
    subscriptionStatus: null,
    pendingPlan: null,
    ...overrides,
  };
}

function baseFormData(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("name", "Ateliê Mira");
  fd.set("whatsapp", "5511999990000");
  fd.set("paymentMethods", "[]");
  fd.set("deliveryMethods", "[]");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

/**
 * O input de CPF/CNPJ em Configurações fica dentro do mesmo <form> das
 * outras configurações da loja — updateStoreSettings precisa gravar
 * `document`, com a mesma validação de dígito verificador usada na
 * assinatura (lib/validation/documento.ts), senão o campo nunca persiste.
 */
describe("updateStoreSettings — documento (CPF/CNPJ)", () => {
  beforeEach(() => {
    getUser.mockReset();
    update.mockReset();
    from.mockReset();
    getCurrentStore.mockReset();

    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    update.mockReturnValue({ eq: () => Promise.resolve({ error: null }) });
    from.mockReturnValue({ update });
    getCurrentStore.mockResolvedValue(baseStore());
  });

  it("grava um CPF válido, normalizado (só dígitos)", async () => {
    const { updateStoreSettings } = await import("@/app/actions/store");

    const result = await updateStoreSettings(
      null,
      baseFormData({ document: "529.982.247-25" })
    );

    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ document: "52998224725" })
    );
  });

  it("rejeita CPF com dígito verificador inválido, sem gravar nada", async () => {
    const { updateStoreSettings } = await import("@/app/actions/store");

    const result = await updateStoreSettings(
      null,
      baseFormData({ document: "111.111.111-11" })
    );

    expect(result).toEqual({ error: "CPF ou CNPJ inválido." });
    expect(update).not.toHaveBeenCalled();
  });

  it("campo vazio grava null — documento continua opcional em Configurações", async () => {
    const { updateStoreSettings } = await import("@/app/actions/store");

    const result = await updateStoreSettings(null, baseFormData());

    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ document: null }));
  });
});
