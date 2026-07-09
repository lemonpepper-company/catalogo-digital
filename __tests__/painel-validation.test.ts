import { describe, it, expect } from "vitest";
import {
  productSchema,
  categoryNameSchema,
  canDeleteCategory,
  storeSettingsSchema,
} from "@/lib/validation/painel";

describe("productSchema", () => {
  it("aceita um produto válido", () => {
    const r = productSchema.safeParse({
      name: "Vestido midi",
      priceCents: 28990,
      stock: 12,
      categoryId: null,
      description: "linho",
    });
    expect(r.success).toBe(true);
  });

  it("rejeita nome vazio", () => {
    const r = productSchema.safeParse({
      name: "",
      priceCents: 1000,
      stock: 0,
      categoryId: null,
      description: null,
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/nome/i);
  });

  it("rejeita preço <= 0", () => {
    const r = productSchema.safeParse({
      name: "X",
      priceCents: 0,
      stock: 0,
      categoryId: null,
      description: null,
    });
    expect(r.success).toBe(false);
  });
});

describe("categoryNameSchema", () => {
  it("rejeita nome curto", () => {
    expect(categoryNameSchema.safeParse("").success).toBe(false);
  });
  it("aceita nome válido", () => {
    expect(categoryNameSchema.safeParse("Acessórios").success).toBe(true);
  });
});

describe("canDeleteCategory", () => {
  it("permite excluir categoria sem produtos", () => {
    expect(canDeleteCategory(0)).toBe(true);
  });
  it("bloqueia categoria com produtos", () => {
    expect(canDeleteCategory(3)).toBe(false);
  });
});

describe("storeSettingsSchema — pagamento, entrega e instagram (novo)", () => {
  const base = {
    name: "Ateliê Mira",
    whatsapp: "5511999990000",
    accentColor: "#C9A96E",
    description: null,
    monogram: null,
    instagram: null,
    analyticsId: null,
    pixelId: null,
    messageTemplate: null,
  };

  it("aceita arrays vazios de pagamento e entrega", () => {
    const r = storeSettingsSchema.safeParse({ ...base, paymentMethods: [], deliveryMethods: [] });
    expect(r.success).toBe(true);
  });

  it("aceita valores válidos de pagamento e entrega", () => {
    const r = storeSettingsSchema.safeParse({
      ...base,
      paymentMethods: ["pix", "cartao"],
      deliveryMethods: ["retirada"],
    });
    expect(r.success).toBe(true);
  });

  it("rejeita forma de pagamento desconhecida", () => {
    const r = storeSettingsSchema.safeParse({
      ...base,
      paymentMethods: ["boleto"],
      deliveryMethods: [],
    });
    expect(r.success).toBe(false);
  });

  it("rejeita forma de entrega desconhecida", () => {
    const r = storeSettingsSchema.safeParse({
      ...base,
      paymentMethods: [],
      deliveryMethods: ["motoboy"],
    });
    expect(r.success).toBe(false);
  });

  it("aceita instagram nulo ou preenchido", () => {
    expect(
      storeSettingsSchema.safeParse({
        ...base,
        paymentMethods: [],
        deliveryMethods: [],
        instagram: "atelieming",
      }).success
    ).toBe(true);
    expect(
      storeSettingsSchema.safeParse({ ...base, paymentMethods: [], deliveryMethods: [] }).success
    ).toBe(true);
  });
});

describe("storeSettingsSchema — whatsapp obrigatório (novo)", () => {
  const base = {
    name: "Ateliê Mira",
    accentColor: "#C9A96E",
    description: null,
    monogram: null,
    instagram: null,
    paymentMethods: [],
    deliveryMethods: [],
    analyticsId: null,
    pixelId: null,
    messageTemplate: null,
  };

  it("rejeita whatsapp nulo", () => {
    const r = storeSettingsSchema.safeParse({ ...base, whatsapp: null });
    expect(r.success).toBe(false);
  });

  it("rejeita whatsapp vazio", () => {
    const r = storeSettingsSchema.safeParse({ ...base, whatsapp: "" });
    expect(r.success).toBe(false);
  });

  it("aceita whatsapp preenchido", () => {
    const r = storeSettingsSchema.safeParse({ ...base, whatsapp: "5511999990000" });
    expect(r.success).toBe(true);
  });

  it("aceita whatsapp formatado com parênteses, espaço e hífen", () => {
    const r = storeSettingsSchema.safeParse({ ...base, whatsapp: "(11) 99999-0000" });
    expect(r.success).toBe(true);
  });

  it("aceita whatsapp com + na frente", () => {
    const r = storeSettingsSchema.safeParse({ ...base, whatsapp: "+55 11 99999-0000" });
    expect(r.success).toBe(true);
  });

  it("rejeita whatsapp com letras", () => {
    const r = storeSettingsSchema.safeParse({ ...base, whatsapp: "meu-whatsapp-aqui" });
    expect(r.success).toBe(false);
  });

  it("rejeita whatsapp curto demais", () => {
    const r = storeSettingsSchema.safeParse({ ...base, whatsapp: "123456" });
    expect(r.success).toBe(false);
  });
});

describe("storeSettingsSchema — limites de tamanho em campos livres (novo)", () => {
  const base = {
    name: "Ateliê Mira",
    whatsapp: "5511999990000",
    accentColor: "#C9A96E",
    monogram: null,
    instagram: null,
    paymentMethods: [],
    deliveryMethods: [],
    analyticsId: null,
    pixelId: null,
  };

  it("rejeita description acima de 500 caracteres", () => {
    const r = storeSettingsSchema.safeParse({
      ...base,
      description: "a".repeat(501),
      messageTemplate: null,
    });
    expect(r.success).toBe(false);
  });

  it("aceita description no limite de 500 caracteres", () => {
    const r = storeSettingsSchema.safeParse({
      ...base,
      description: "a".repeat(500),
      messageTemplate: null,
    });
    expect(r.success).toBe(true);
  });

  it("rejeita messageTemplate acima de 2000 caracteres", () => {
    const r = storeSettingsSchema.safeParse({
      ...base,
      description: null,
      messageTemplate: "a".repeat(2001),
    });
    expect(r.success).toBe(false);
  });

  it("rejeita instagram acima de 100 caracteres", () => {
    const r = storeSettingsSchema.safeParse({
      ...base,
      description: null,
      messageTemplate: null,
      instagram: "a".repeat(101),
    });
    expect(r.success).toBe(false);
  });
});
