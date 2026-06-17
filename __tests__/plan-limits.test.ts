import { describe, it, expect } from "vitest";
import { getPlanLimits, isTrialActive } from "@/lib/plan-limits";

describe("isTrialActive", () => {
  it("é true quando trial_ends_at está no futuro", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(isTrialActive(future)).toBe(true);
  });

  it("é false quando trial_ends_at já passou", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(isTrialActive(past)).toBe(false);
  });
});

describe("getPlanLimits", () => {
  it("starter tem limites finitos", () => {
    expect(getPlanLimits("starter", false)).toEqual({
      maxProducts: 30,
      maxCategories: 5,
      maxPhotos: 3,
    });
  });

  it("pro tem produtos/categorias ilimitados e 5 fotos", () => {
    expect(getPlanLimits("pro", false)).toEqual({
      maxProducts: Infinity,
      maxCategories: Infinity,
      maxPhotos: 5,
    });
  });

  it("trial ativo (plan null + trial futuro) usa limites Pro", () => {
    expect(getPlanLimits(null, true)).toEqual({
      maxProducts: Infinity,
      maxCategories: Infinity,
      maxPhotos: 5,
    });
  });

  it("plan null com trial expirado cai para Starter", () => {
    expect(getPlanLimits(null, false)).toEqual({
      maxProducts: 30,
      maxCategories: 5,
      maxPhotos: 3,
    });
  });
});
