import { describe, it, expect, vi, beforeEach } from "vitest";
import type { StoreSettings } from "@/lib/types";

const getUser = vi.fn();
const update = vi.fn();
const from = vi.fn();
const getCurrentStore = vi.fn();
const atualizarCliente = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve({ auth: { getUser }, from })),
}));

vi.mock("@/lib/server/store", () => ({
  getCurrentStore: () => getCurrentStore(),
}));

vi.mock("@/lib/asaas/subscriptions", () => ({ atualizarCliente }));

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

beforeEach(() => {
  getUser.mockReset();
  update.mockReset();
  from.mockReset();
  getCurrentStore.mockReset();
  atualizarCliente.mockReset();

  getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "ana@atelie.test" } } });
  update.mockReturnValue({ eq: () => Promise.resolve({ error: null }) });
  from.mockReturnValue({ update });
  getCurrentStore.mockResolvedValue(baseStore());
});

function enderecoCompleto(overrides: Record<string, string> = {}) {
  return {
    postalCode: "01001-000",
    addressNumber: "123",
    address: "Rua das Flores",
    addressProvince: "Centro",
    addressCity: "São Paulo",
    ...overrides,
  };
}

/**
 * CEP, número, rua, bairro e cidade em Configurações — rua/bairro/cidade
 * são só sugeridos pelo CEP no cliente (nem todo CEP tem esses três dados
 * no ViaCEP), quem decide o que é salvo é o formulário.
 */
describe("updateStoreSettings — endereço (CEP, número, rua, bairro, cidade)", () => {
  it("grava o endereço normalizado quando os cinco campos vêm preenchidos", async () => {
    const { updateStoreSettings } = await import("@/app/actions/store");

    const result = await updateStoreSettings(null, baseFormData(enderecoCompleto()));

    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        address: "Rua das Flores",
        address_number: "123",
        address_province: "Centro",
        address_city: "São Paulo",
        address_postal_code: "01001000",
      })
    );
  });

  it("algum campo de endereço faltando devolve erro, sem gravar nada", async () => {
    const { updateStoreSettings } = await import("@/app/actions/store");

    const result = await updateStoreSettings(
      null,
      baseFormData(enderecoCompleto({ addressCity: "" }))
    );

    expect(result).toEqual({
      error: "Preencha CEP, número, rua, bairro e cidade juntos, ou deixe todos em branco.",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("CEP inválido devolve erro sem gravar", async () => {
    const { updateStoreSettings } = await import("@/app/actions/store");

    const result = await updateStoreSettings(
      null,
      baseFormData(enderecoCompleto({ postalCode: "123" }))
    );

    expect(result).toEqual({ error: "CEP inválido." });
    expect(update).not.toHaveBeenCalled();
  });

  it("todos em branco grava null — endereço continua opcional", async () => {
    const { updateStoreSettings } = await import("@/app/actions/store");

    const result = await updateStoreSettings(null, baseFormData());

    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        address: null,
        address_number: null,
        address_province: null,
        address_city: null,
        address_postal_code: null,
      })
    );
  });
});

/**
 * O customer no Asaas guarda uma cópia de nome/documento/email/telefone/
 * endereço — sem sincronizar depois de editar em Configurações, a próxima
 * cobrança usa o cadastro antigo (mesma classe de bug já achada na hora de
 * assinar: customer incompleto/desatualizado quebra o checkout).
 */
describe("updateStoreSettings — sincronização com o Asaas", () => {
  it("já tem asaas_customer_id: sincroniza o customer com os dados novos", async () => {
    getCurrentStore.mockResolvedValue(baseStore({ asaasCustomerId: "cus_1" }));
    const { updateStoreSettings } = await import("@/app/actions/store");

    await updateStoreSettings(
      null,
      baseFormData({
        document: "529.982.247-25",
        ...enderecoCompleto(),
      })
    );

    expect(atualizarCliente).toHaveBeenCalledWith(
      "cus_1",
      expect.objectContaining({
        name: "Ateliê Mira",
        cpfCnpj: "52998224725",
        email: "ana@atelie.test",
        phone: "5511999990000",
        address: "Rua das Flores",
        addressNumber: "123",
      })
    );
  });

  it("sem asaas_customer_id, não tenta sincronizar nada", async () => {
    getCurrentStore.mockResolvedValue(baseStore({ asaasCustomerId: null }));
    const { updateStoreSettings } = await import("@/app/actions/store");

    await updateStoreSettings(null, baseFormData({ document: "529.982.247-25" }));

    expect(atualizarCliente).not.toHaveBeenCalled();
  });

  it("sem documento (mesmo com customer existente), não sincroniza — Asaas exige cpfCnpj em qualquer PUT", async () => {
    getCurrentStore.mockResolvedValue(baseStore({ asaasCustomerId: "cus_1", document: null }));
    const { updateStoreSettings } = await import("@/app/actions/store");

    await updateStoreSettings(null, baseFormData());

    expect(atualizarCliente).not.toHaveBeenCalled();
  });

  it("falha ao sincronizar com o Asaas não derruba o salvamento local", async () => {
    getCurrentStore.mockResolvedValue(baseStore({ asaasCustomerId: "cus_1" }));
    atualizarCliente.mockRejectedValue(new Error("Asaas fora do ar"));
    const { updateStoreSettings } = await import("@/app/actions/store");

    const result = await updateStoreSettings(
      null,
      baseFormData({ document: "529.982.247-25" })
    );

    expect(result).toEqual({ ok: true });
  });
});
