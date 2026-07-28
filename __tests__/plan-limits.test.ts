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
    });
  });

  it("starter tem limites intermediários", () => {
    expect(getPlanLimits("starter", null)).toEqual({
      maxProducts: 30,
      maxCategories: 5,
      maxPhotos: 3,
      hasOrderHistory: true,
    });
  });

  it("pro tem produtos/categorias ilimitados e 5 fotos", () => {
    expect(getPlanLimits("pro", null)).toEqual({
      maxProducts: Infinity,
      maxCategories: Infinity,
      maxPhotos: 5,
      hasOrderHistory: true,
    });
  });

  it("starter com trial_ends_at expirado cai para os limites do Free", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(getPlanLimits("starter", past)).toEqual({
      maxProducts: 8,
      maxCategories: 1,
      maxPhotos: 1,
      hasOrderHistory: false,
    });
  });

  it("pro com trial_ends_at expirado cai para os limites do Free", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(getPlanLimits("pro", past)).toEqual({
      maxProducts: 8,
      maxCategories: 1,
      maxPhotos: 1,
      hasOrderHistory: false,
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
