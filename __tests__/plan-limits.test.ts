import { describe, it, expect } from "vitest";
import { getPlanLimits, getEffectivePlan } from "@/lib/plan-limits";

describe("getEffectivePlan", () => {
  it("mantém free como free", () => {
    expect(getEffectivePlan("free", null)).toBe("free");
  });

  it("mantém starter/pro quando trial_ends_at é nulo (indeterminado)", () => {
    expect(getEffectivePlan("starter", null)).toBe("starter");
    expect(getEffectivePlan("pro", null)).toBe("pro");
  });

  it("mantém starter/pro quando trial_ends_at está no futuro", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(getEffectivePlan("starter", future)).toBe("starter");
    expect(getEffectivePlan("pro", future)).toBe("pro");
  });

  it("rebaixa starter/pro para free quando trial_ends_at já passou", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(getEffectivePlan("starter", past)).toBe("free");
    expect(getEffectivePlan("pro", past)).toBe("free");
  });
});

describe("getPlanLimits", () => {
  it("free tem limites reduzidos", () => {
    expect(getPlanLimits("free", null)).toEqual({
      maxProducts: 8,
      maxCategories: 1,
      maxPhotos: 1,
      hasOrderHistory: false,
      maxFeaturedProducts: 0,
      themeOptions: false,
      advancedTheme: false,
      gridDensity: false,
      customDomain: false,
    });
  });

  it("starter tem limites intermediários", () => {
    expect(getPlanLimits("starter", null)).toEqual({
      maxProducts: 30,
      maxCategories: 5,
      maxPhotos: 3,
      hasOrderHistory: true,
      maxFeaturedProducts: 3,
      themeOptions: true,
      advancedTheme: false,
      gridDensity: true,
      customDomain: false,
    });
  });

  it("pro tem produtos/categorias ilimitados e 5 fotos", () => {
    expect(getPlanLimits("pro", null)).toEqual({
      maxProducts: Infinity,
      maxCategories: Infinity,
      maxPhotos: 5,
      hasOrderHistory: true,
      maxFeaturedProducts: Infinity,
      themeOptions: true,
      advancedTheme: true,
      gridDensity: true,
      customDomain: true,
    });
  });

  it("starter com trial_ends_at expirado cai para os limites do Free", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(getPlanLimits("starter", past)).toEqual({
      maxProducts: 8,
      maxCategories: 1,
      maxPhotos: 1,
      hasOrderHistory: false,
      maxFeaturedProducts: 0,
      themeOptions: false,
      advancedTheme: false,
      gridDensity: false,
      customDomain: false,
    });
  });

  it("pro com trial_ends_at expirado cai para os limites do Free", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(getPlanLimits("pro", past)).toEqual({
      maxProducts: 8,
      maxCategories: 1,
      maxPhotos: 1,
      hasOrderHistory: false,
      maxFeaturedProducts: 0,
      themeOptions: false,
      advancedTheme: false,
      gridDensity: false,
      customDomain: false,
    });
  });
});

describe("getPlanLimits — hasOrderHistory", () => {
  it("free não tem acesso ao histórico de pedidos", () => {
    expect(getPlanLimits("free", null).hasOrderHistory).toBe(false);
  });

  it("starter tem acesso ao histórico de pedidos", () => {
    expect(getPlanLimits("starter", null).hasOrderHistory).toBe(true);
  });

  it("pro tem acesso ao histórico de pedidos", () => {
    expect(getPlanLimits("pro", null).hasOrderHistory).toBe(true);
  });

  it("starter com trial_ends_at vencido perde o acesso ao histórico", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(getPlanLimits("starter", past).hasOrderHistory).toBe(false);
  });

  it("pro com trial_ends_at vencido perde o acesso ao histórico", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(getPlanLimits("pro", past).hasOrderHistory).toBe(false);
  });

  it("starter com trial_ends_at no futuro mantém o acesso ao histórico", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(getPlanLimits("starter", future).hasOrderHistory).toBe(true);
  });
});

describe("getPlanLimits — feature flags de personalização", () => {
  it("free não tem nenhuma flag de personalização", () => {
    const limits = getPlanLimits("free", null);
    expect(limits.maxFeaturedProducts).toBe(0);
    expect(limits.themeOptions).toBe(false);
    expect(limits.advancedTheme).toBe(false);
    expect(limits.gridDensity).toBe(false);
  });

  it("starter libera fonte/fundo/cantos, densidade e até 3 destaques, mas não cor secundária", () => {
    const limits = getPlanLimits("starter", null);
    expect(limits.maxFeaturedProducts).toBe(3);
    expect(limits.themeOptions).toBe(true);
    expect(limits.gridDensity).toBe(true);
    expect(limits.advancedTheme).toBe(false);
  });

  it("pro libera tudo, incluindo cor secundária e destaques ilimitados", () => {
    const limits = getPlanLimits("pro", null);
    expect(limits.maxFeaturedProducts).toBe(Infinity);
    expect(limits.themeOptions).toBe(true);
    expect(limits.advancedTheme).toBe(true);
    expect(limits.gridDensity).toBe(true);
  });

  it("starter/pro com trial_ends_at expirado perdem as flags (caem para Free)", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const limits = getPlanLimits("pro", past);
    expect(limits.themeOptions).toBe(false);
    expect(limits.maxFeaturedProducts).toBe(0);
  });
});

describe("getPlanLimits — domínio próprio", () => {
  it("free e starter não têm domínio próprio", () => {
    expect(getPlanLimits("free", null).customDomain).toBe(false);
    expect(getPlanLimits("starter", null).customDomain).toBe(false);
  });

  it("pro tem domínio próprio", () => {
    expect(getPlanLimits("pro", null).customDomain).toBe(true);
  });

  it("pro com trial_ends_at expirado perde o domínio próprio (cai para Free)", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(getPlanLimits("pro", past).customDomain).toBe(false);
  });
});
