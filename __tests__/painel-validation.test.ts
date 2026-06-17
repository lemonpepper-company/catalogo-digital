import { describe, it, expect } from "vitest";
import {
  productSchema,
  categoryNameSchema,
  canDeleteCategory,
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
