import { describe, it, expect } from "vitest";
import { computeConversionPct } from "@/lib/catalog-metrics";

describe("computeConversionPct — taxa sacola → pedido (ANL-12)", () => {
  it("calcula a porcentagem de pedidos sobre visitantes com sacola", () => {
    expect(computeConversionPct(1, 4)).toBe(25);
    expect(computeConversionPct(3, 10)).toBe(30);
    expect(computeConversionPct(10, 10)).toBe(100);
  });

  it("arredonda para uma casa decimal", () => {
    expect(computeConversionPct(1, 3)).toBe(33.3);
    expect(computeConversionPct(2, 3)).toBe(66.7);
    expect(computeConversionPct(1, 7)).toBe(14.3);
  });

  it("devolve 0 quando não houve pedido, mas houve sacola", () => {
    expect(computeConversionPct(0, 5)).toBe(0);
  });
});

describe("computeConversionPct — edge cases da spec (ANL-16)", () => {
  it("devolve null quando ninguém montou sacola no período (UI exibe '—')", () => {
    expect(computeConversionPct(0, 0)).toBeNull();
    expect(computeConversionPct(3, 0)).toBeNull();
  });

  it("não capa em 100% quando há mais pedidos que visitantes com sacola", () => {
    expect(computeConversionPct(3, 2)).toBe(150);
    expect(computeConversionPct(10, 1)).toBe(1000);
  });

  it("período totalmente vazio devolve null, não zero", () => {
    expect(computeConversionPct(0, 0)).not.toBe(0);
    expect(computeConversionPct(0, 0)).toBeNull();
  });
});
