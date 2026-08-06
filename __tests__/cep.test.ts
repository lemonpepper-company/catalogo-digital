import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validarCep, normalizarCep } from "@/lib/validation/cep";
import { buscarEnderecoPorCep } from "@/lib/server/cep";

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

/**
 * ViaCEP é serviço público sem SLA formal — sem timeout, um request
 * pendurado seguraria a Server Action (updateStoreSettings/salvarEndereco)
 * até o limite da função. O catch já existente trata o abort igual a
 * qualquer outra falha de rede: devolve null, e o lojista digita à mão.
 */
describe("buscarEnderecoPorCep — timeout", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("fetch que rejeita por timeout (AbortError) devolve null", async () => {
    const abortError = new DOMException("The operation was aborted.", "TimeoutError");
    vi.mocked(global.fetch).mockRejectedValue(abortError);

    const resultado = await buscarEnderecoPorCep("01001000");

    expect(resultado).toBeNull();
  });

  it("passa um AbortSignal com timeout para o fetch", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ logradouro: "Rua X", bairro: "Bairro X", localidade: "Cidade X" }), {
        status: 200,
      })
    );

    await buscarEnderecoPorCep("01001000");

    const init = vi.mocked(global.fetch).mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
