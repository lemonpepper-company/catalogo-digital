import { describe, it, expect } from "vitest";
import { getPlanLimits, getEffectivePlan } from "@/lib/plan-limits";

describe("getEffectivePlan", () => {
  const futuro = new Date(Date.now() + 86_400_000).toISOString();
  const passado = "2020-01-01T00:00:00.000Z";

  it("free continua free, independente da data", () => {
    expect(getEffectivePlan("free", passado)).toBe("free");
    expect(getEffectivePlan("free", futuro)).toBe("free");
    expect(getEffectivePlan("free", null)).toBe("free");
  });

  it("mantém starter/pro quando plan_expires_at é nulo (indeterminado)", () => {
    expect(getEffectivePlan("starter", null)).toBe("starter");
    expect(getEffectivePlan("pro", null)).toBe("pro");
  });

  it("mantém starter/pro quando plan_expires_at está no futuro", () => {
    expect(getEffectivePlan("starter", futuro)).toBe("starter");
    expect(getEffectivePlan("pro", futuro)).toBe("pro");
  });

  it("rebaixa starter/pro para free quando plan_expires_at já passou", () => {
    expect(getEffectivePlan("starter", passado)).toBe("free");
    expect(getEffectivePlan("pro", passado)).toBe("free");
  });
});

describe("getEffectivePlan — período de graça", () => {
  /**
   * A graça de 3 dias é implementada empurrando plan_expires_at (Spec 2B),
   * nunca lendo subscription_status. Este teste existe para travar isso: se
   * alguém tentar fazer o acesso depender do status, ele quebra.
   */
  it("cobrança falhada com data no futuro continua liberando o plano", () => {
    const dentroDaGraca = new Date(Date.now() + 2 * 86_400_000).toISOString();
    expect(getEffectivePlan("pro", dentroDaGraca)).toBe("pro");
  });

  it("graça vencida cai para free", () => {
    const gracaVencida = new Date(Date.now() - 1000).toISOString();
    expect(getEffectivePlan("pro", gracaVencida)).toBe("free");
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
      gridDensity: false,
      csvImport: false,
      customDomain: false,
      hasAnalytics: false,
    });
  });

  it("starter tem limites intermediários", () => {
    expect(getPlanLimits("starter", null)).toEqual({
      maxProducts: 50,
      maxCategories: 7,
      maxPhotos: 3,
      hasOrderHistory: true,
      maxFeaturedProducts: 3,
      themeOptions: true,
      gridDensity: true,
      csvImport: false,
      customDomain: false,
      hasAnalytics: false,
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
      gridDensity: true,
      csvImport: true,
      customDomain: true,
      hasAnalytics: true,
    });
  });

  it("starter com plan_expires_at expirado cai para os limites do Free", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(getPlanLimits("starter", past)).toEqual({
      maxProducts: 8,
      maxCategories: 1,
      maxPhotos: 1,
      hasOrderHistory: false,
      maxFeaturedProducts: 0,
      themeOptions: false,
      gridDensity: false,
      csvImport: false,
      customDomain: false,
      hasAnalytics: false,
    });
  });

  it("pro com plan_expires_at expirado cai para os limites do Free", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(getPlanLimits("pro", past)).toEqual({
      maxProducts: 8,
      maxCategories: 1,
      maxPhotos: 1,
      hasOrderHistory: false,
      maxFeaturedProducts: 0,
      themeOptions: false,
      gridDensity: false,
      csvImport: false,
      customDomain: false,
      hasAnalytics: false,
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

  it("starter com plan_expires_at vencido perde o acesso ao histórico", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(getPlanLimits("starter", past).hasOrderHistory).toBe(false);
  });

  it("pro com plan_expires_at vencido perde o acesso ao histórico", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(getPlanLimits("pro", past).hasOrderHistory).toBe(false);
  });

  it("starter com plan_expires_at no futuro mantém o acesso ao histórico", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(getPlanLimits("starter", future).hasOrderHistory).toBe(true);
  });
});

describe("getPlanLimits — feature flags de personalização", () => {
  it("free não tem nenhuma flag de personalização", () => {
    const limits = getPlanLimits("free", null);
    expect(limits.maxFeaturedProducts).toBe(0);
    expect(limits.themeOptions).toBe(false);
    expect(limits.gridDensity).toBe(false);
  });

  it("starter libera fonte/fundo/cantos, densidade e até 3 destaques", () => {
    const limits = getPlanLimits("starter", null);
    expect(limits.maxFeaturedProducts).toBe(3);
    expect(limits.themeOptions).toBe(true);
    expect(limits.gridDensity).toBe(true);
  });

  it("pro libera tudo, incluindo destaques ilimitados", () => {
    const limits = getPlanLimits("pro", null);
    expect(limits.maxFeaturedProducts).toBe(Infinity);
    expect(limits.themeOptions).toBe(true);
    expect(limits.gridDensity).toBe(true);
  });

  it("starter/pro com plan_expires_at expirado perdem as flags (caem para Free)", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const limits = getPlanLimits("pro", past);
    expect(limits.themeOptions).toBe(false);
    expect(limits.maxFeaturedProducts).toBe(0);
  });
});

describe("getPlanLimits — importação CSV", () => {
  it("free e starter não têm importação CSV", () => {
    expect(getPlanLimits("free", null).csvImport).toBe(false);
    expect(getPlanLimits("starter", null).csvImport).toBe(false);
  });

  it("pro tem importação CSV", () => {
    expect(getPlanLimits("pro", null).csvImport).toBe(true);
  });

  it("pro com plan_expires_at expirado perde a importação CSV (cai para Free)", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(getPlanLimits("pro", past).csvImport).toBe(false);
  });
});

describe("getPlanLimits — métricas da vitrine (APO-07)", () => {
  it("free não tem métricas da vitrine", () => {
    expect(getPlanLimits("free", null).hasAnalytics).toBe(false);
  });

  it("starter não tem métricas da vitrine", () => {
    expect(getPlanLimits("starter", null).hasAnalytics).toBe(false);
  });

  it("pro tem métricas da vitrine", () => {
    expect(getPlanLimits("pro", null).hasAnalytics).toBe(true);
  });

  it("pro com plan_expires_at expirado perde as métricas da vitrine (cai para Free)", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(getPlanLimits("pro", past).hasAnalytics).toBe(false);
  });

  it("pro com plan_expires_at no futuro mantém as métricas da vitrine", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(getPlanLimits("pro", future).hasAnalytics).toBe(true);
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

  it("pro com plan_expires_at expirado perde o domínio próprio (cai para Free)", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(getPlanLimits("pro", past).customDomain).toBe(false);
  });
});
