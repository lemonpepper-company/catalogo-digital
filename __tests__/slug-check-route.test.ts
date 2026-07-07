import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getUser = vi.fn();
const checkRateLimit = vi.fn();
const from = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve({ auth: { getUser }, from })),
}));

vi.mock("@/lib/server/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
}));

function makeRequest(slug: string) {
  return new NextRequest(`http://localhost/api/slug/check?slug=${slug}`);
}

describe("GET /api/slug/check", () => {
  beforeEach(() => {
    getUser.mockReset();
    checkRateLimit.mockReset().mockResolvedValue(true);
    from.mockReset();
  });

  it("retorna 401 quando não autenticado — único consumidor exige sessão", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { GET } = await import("../app/api/slug/check/route");

    const res = await GET(makeRequest("boutique"));

    expect(res.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it("retorna 400 para slug inválido, mesmo sem checar auth", async () => {
    const { GET } = await import("../app/api/slug/check/route");
    const res = await GET(makeRequest("A B"));
    expect(res.status).toBe(400);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("retorna 429 quando o rate limit (por usuário) estoura", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    checkRateLimit.mockResolvedValue(false);
    const { GET } = await import("../app/api/slug/check/route");

    const res = await GET(makeRequest("boutique"));

    expect(res.status).toBe(429);
    expect(checkRateLimit).toHaveBeenCalledWith("slug-check:user-1");
  });

  it("retorna available:true quando autenticado e slug livre", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    from.mockReturnValue({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }),
      }),
    });
    const { GET } = await import("../app/api/slug/check/route");

    const res = await GET(makeRequest("boutique"));
    const body = await res.json();

    expect(body).toEqual({ available: true });
  });
});
