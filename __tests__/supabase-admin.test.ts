import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const createClient = vi.fn(() => ({ from: vi.fn() }));

vi.mock("@supabase/supabase-js", () => ({ createClient }));

const SECRET = "service-role-key-super-secreta";

describe("createAdminClient", () => {
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  beforeEach(() => {
    createClient.mockClear();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  });

  it("lança erro com mensagem clara quando SUPABASE_SERVICE_ROLE_KEY está ausente", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { createAdminClient } = await import("@/lib/supabase/admin");

    expect(() => createAdminClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("lança erro quando a chave está vazia ou só com espaços", async () => {
    const { createAdminClient } = await import("@/lib/supabase/admin");

    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    expect(() => createAdminClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);

    process.env.SUPABASE_SERVICE_ROLE_KEY = "   ";
    expect(() => createAdminClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);

    expect(createClient).not.toHaveBeenCalled();
  });

  it("nunca expõe o valor da chave na mensagem de erro", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "   ";
    const { createAdminClient } = await import("@/lib/supabase/admin");

    try {
      createAdminClient();
      throw new Error("createAdminClient deveria ter lançado");
    } catch (err) {
      expect((err as Error).message).not.toContain(SECRET);
      expect((err as Error).message).not.toContain("   ");
    }
  });

  it("passa a URL do Supabase e a service role key para o client", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET;
    const { createAdminClient } = await import("@/lib/supabase/admin");

    createAdminClient();

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient.mock.calls[0][0]).toBe("http://127.0.0.1:54321");
    expect(createClient.mock.calls[0][1]).toBe(SECRET);
  });

  it("cria o client stateless: sem persistir sessão nem renovar token", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET;
    const { createAdminClient } = await import("@/lib/supabase/admin");

    createAdminClient();

    expect(createClient.mock.calls[0][2]).toEqual({
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });
});
