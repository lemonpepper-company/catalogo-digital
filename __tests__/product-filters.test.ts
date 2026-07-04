import { describe, it, expect } from "vitest";
import {
  NO_CATEGORY_VALUE,
  STATUS_OPTIONS,
  isValidStatus,
  isValidCategoria,
} from "@/lib/product-filters";

describe("isValidStatus", () => {
  it("aceita os três valores de status conhecidos", () => {
    expect(isValidStatus("ativo")).toBe(true);
    expect(isValidStatus("esgotado")).toBe(true);
    expect(isValidStatus("inativo")).toBe(true);
  });

  it("rejeita valor desconhecido", () => {
    expect(isValidStatus("qualquer-coisa")).toBe(false);
  });

  it("rejeita undefined", () => {
    expect(isValidStatus(undefined)).toBe(false);
  });
});

describe("isValidCategoria", () => {
  const categories = [{ id: "cat-1" }, { id: "cat-2" }];

  it("aceita um id de categoria existente", () => {
    expect(isValidCategoria("cat-1", categories)).toBe(true);
  });

  it("aceita o valor sentinela de sem categoria", () => {
    expect(isValidCategoria(NO_CATEGORY_VALUE, categories)).toBe(true);
  });

  it("rejeita um id que não existe entre as categorias", () => {
    expect(isValidCategoria("cat-inexistente", categories)).toBe(false);
  });

  it("rejeita undefined", () => {
    expect(isValidCategoria(undefined, categories)).toBe(false);
  });
});

describe("STATUS_OPTIONS", () => {
  it("expõe os três status na ordem ativo, esgotado, inativo", () => {
    expect(STATUS_OPTIONS.map((o) => o.value)).toEqual([
      "ativo",
      "esgotado",
      "inativo",
    ]);
  });

  it("cada status tem um label legível", () => {
    expect(STATUS_OPTIONS.find((o) => o.value === "ativo")?.label).toBe("Ativos");
    expect(STATUS_OPTIONS.find((o) => o.value === "esgotado")?.label).toBe("Esgotados");
    expect(STATUS_OPTIONS.find((o) => o.value === "inativo")?.label).toBe("Inativos");
  });
});
