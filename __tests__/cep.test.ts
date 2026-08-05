import { describe, it, expect } from "vitest";
import { validarCep, normalizarCep } from "@/lib/validation/cep";

describe("normalizarCep", () => {
  it("mantém só dígitos", () => {
    expect(normalizarCep("01001-000")).toBe("01001000");
  });
});

describe("validarCep", () => {
  it("aceita CEP com 8 dígitos, com ou sem máscara", () => {
    expect(validarCep("01001-000")).toBe(true);
    expect(validarCep("01001000")).toBe(true);
  });

  it("rejeita CEP com tamanho errado", () => {
    expect(validarCep("123")).toBe(false);
    expect(validarCep("")).toBe(false);
  });
});
