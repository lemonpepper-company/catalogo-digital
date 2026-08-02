import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.ASAAS_BASE_URL = "https://api-sandbox.asaas.com/v3";
  process.env.ASAAS_API_KEY = "chave-de-teste";
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.restoreAllMocks();
});

describe("asaasFetch", () => {
  it("envia a chave no header access_token e devolve o JSON", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: "sub_1" }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { asaasFetch } = await import("@/lib/asaas/client");
    const r = await asaasFetch<{ id: string }>("/subscriptions", {
      method: "POST",
      body: { value: 29.9 },
    });

    expect(r).toEqual({ id: "sub_1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api-sandbox.asaas.com/v3/subscriptions");
    expect((init as RequestInit).headers).toMatchObject({
      access_token: "chave-de-teste",
      "Content-Type": "application/json",
    });
  });

  it("lança com a descrição do erro devolvida pelo Asaas", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ errors: [{ description: "O campo subscription é inválido." }] }),
          { status: 400 }
        )
      )
    );

    const { asaasFetch } = await import("@/lib/asaas/client");
    await expect(asaasFetch("/subscriptions", { method: "POST", body: {} })).rejects.toThrow(
      "O campo subscription é inválido."
    );
  });

  it("lança quando ASAAS_API_KEY não está configurada", async () => {
    delete process.env.ASAAS_API_KEY;
    const { asaasFetch } = await import("@/lib/asaas/client");
    await expect(asaasFetch("/subscriptions")).rejects.toThrow(/ASAAS_API_KEY/);
  });

  it("nunca inclui a chave na mensagem de erro", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("erro opaco", { status: 500 }))
    );
    const { asaasFetch } = await import("@/lib/asaas/client");
    await expect(asaasFetch("/subscriptions")).rejects.not.toThrow(/chave-de-teste/);
  });
});
