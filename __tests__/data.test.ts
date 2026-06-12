import { describe, it, expect } from "vitest";
import { PRODUCTS, STORE } from "@/lib/data";

describe("STORE", () => {
  it("has required fields", () => {
    expect(STORE.name).toBeTruthy();
    expect(STORE.monogram).toHaveLength(2);
    expect(STORE.whatsapp).toMatch(/^\d+$/);
    expect(STORE.categories.length).toBeGreaterThan(0);
    expect(STORE.categories[0]).toBe("Todos");
  });
});

describe("PRODUCTS", () => {
  it("has at least one product", () => {
    expect(PRODUCTS.length).toBeGreaterThan(0);
  });

  it("each product has required fields", () => {
    for (const p of PRODUCTS) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.price).toMatch(/^R\$/);
      expect(p.category).toBeTruthy();
      expect(Array.isArray(p.sizes)).toBe(true);
      expect(Array.isArray(p.colors)).toBe(true);
    }
  });

  it("soldOut products have all sizes in soldSizes", () => {
    const soldOut = PRODUCTS.filter((p) => p.soldOut);
    for (const p of soldOut) {
      expect(p.soldSizes.length).toBeGreaterThanOrEqual(p.sizes.length);
    }
  });

  it("product IDs are unique", () => {
    const ids = PRODUCTS.map((p) => p.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
