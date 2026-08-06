import { describe, it, expect } from "vitest";
import { validarDocumento, normalizarDocumento } from "@/lib/validation/documento";

describe("normalizarDocumento", () => {
  it("remove pontuação", () => {
    expect(normalizarDocumento("529.982.247-25")).toBe("52998224725");
    expect(normalizarDocumento("11.222.333/0001-81")).toBe("11222333000181");
  });
});

describe("validarDocumento — CPF", () => {
  it("aceita CPF válido, com ou sem máscara", () => {
    expect(validarDocumento("529.982.247-25")).toBe(true);
    expect(validarDocumento("52998224725")).toBe(true);
  });

  it("rejeita dígito verificador errado", () => {
    expect(validarDocumento("529.982.247-26")).toBe(false);
  });

  it("rejeita sequência repetida", () => {
    expect(validarDocumento("111.111.111-11")).toBe(false);
  });
});

describe("validarDocumento — CNPJ", () => {
  it("aceita CNPJ válido", () => {
    expect(validarDocumento("11.222.333/0001-81")).toBe(true);
  });

  it("rejeita dígito verificador errado", () => {
    expect(validarDocumento("11.222.333/0001-82")).toBe(false);
  });
});

describe("validarDocumento — entradas inválidas", () => {
  it.each(["", "   ", "123", "abcdefghijk", "5299822472"])("%s é inválido", (v) => {
    expect(validarDocumento(v)).toBe(false);
  });
});
