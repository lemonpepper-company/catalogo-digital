import { describe, it, expect } from "vitest";
import { getSafeRedirect } from "../lib/auth/safe-redirect";

describe("getSafeRedirect", () => {
  it("permite um path relativo simples", () => {
    expect(getSafeRedirect("/painel/produtos", "/painel")).toBe("/painel/produtos");
  });

  it("preserva query string e hash de um path relativo", () => {
    expect(getSafeRedirect("/cadastro?step=loja", "/painel")).toBe("/cadastro?step=loja");
  });

  it("retorna o fallback quando next é null", () => {
    expect(getSafeRedirect(null, "/painel")).toBe("/painel");
  });

  it("retorna o fallback quando next é string vazia", () => {
    expect(getSafeRedirect("", "/painel")).toBe("/painel");
  });

  it("rejeita URL absoluta para outro host", () => {
    expect(getSafeRedirect("https://evil.com/phish", "/painel")).toBe("/painel");
  });

  it("rejeita protocol-relative URL (//evil.com)", () => {
    expect(getSafeRedirect("//evil.com", "/painel")).toBe("/painel");
  });

  it("rejeita o bypass via barra invertida (/\\evil.com)", () => {
    expect(getSafeRedirect("/\\evil.com", "/painel")).toBe("/painel");
  });

  it("rejeita o bypass via barra invertida dupla (\\\\evil.com)", () => {
    expect(getSafeRedirect("\\\\evil.com", "/painel")).toBe("/painel");
  });

  it("rejeita esquema não http(s), como javascript:", () => {
    expect(getSafeRedirect("javascript:alert(1)", "/painel")).toBe("/painel");
  });
});
