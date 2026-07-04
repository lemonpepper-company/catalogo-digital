import { describe, it, expect } from "vitest";
import { getTotalPages, clampPage, getPageRange } from "@/lib/pagination";

describe("getTotalPages", () => {
  it("arredonda para cima", () => {
    expect(getTotalPages(45, 20)).toBe(3);
  });

  it("retorna 1 quando não há itens", () => {
    expect(getTotalPages(0, 20)).toBe(1);
  });

  it("retorna 1 quando total é múltiplo exato do tamanho da página", () => {
    expect(getTotalPages(40, 20)).toBe(2);
  });
});

describe("clampPage", () => {
  it("mantém uma página válida", () => {
    expect(clampPage(2, 5)).toBe(2);
  });

  it("agarra página maior que o total na última página", () => {
    expect(clampPage(999, 5)).toBe(5);
  });

  it("agarra página menor que 1 na primeira página", () => {
    expect(clampPage(0, 5)).toBe(1);
    expect(clampPage(-3, 5)).toBe(1);
  });

  it("agarra valor não numérico (NaN) na primeira página", () => {
    expect(clampPage(Number("abc"), 5)).toBe(1);
  });

  it("trunca páginas fracionárias", () => {
    expect(clampPage(2.9, 5)).toBe(2);
  });
});

describe("getPageRange", () => {
  it("mostra todas as páginas quando são poucas (<=7)", () => {
    expect(getPageRange(1, 3)).toEqual([1, 2, 3]);
    expect(getPageRange(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("mostra reticências no fim quando a página atual está no início", () => {
    expect(getPageRange(1, 12)).toEqual([1, 2, "ellipsis", 12]);
  });

  it("mostra reticências no início quando a página atual está no fim", () => {
    expect(getPageRange(12, 12)).toEqual([1, "ellipsis", 11, 12]);
  });

  it("mostra reticências dos dois lados quando a página atual está no meio", () => {
    expect(getPageRange(6, 12)).toEqual([1, "ellipsis", 5, 6, 7, "ellipsis", 12]);
  });
});
