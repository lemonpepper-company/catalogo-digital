import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getUser = vi.fn();
const from = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser }, from }),
}));

/**
 * `NextResponse.next({ request })` exige que `request.headers` seja instância do
 * `Headers` global; o `NextRequest` construído sob jsdom traz o `Headers` do
 * undici, que é outra classe. Trocar o objeto de headers é só ajuste de ambiente
 * de teste — nenhum comportamento do middleware depende deles.
 */
function makeRequest(pathname: string) {
  const request = new NextRequest(`http://localhost:3000${pathname}`);
  Object.defineProperty(request, "headers", {
    value: new Headers(),
    configurable: true,
  });
  return request;
}

function storeFound(id: string | null) {
  from.mockReturnValue({
    select: () => ({
      eq: () => ({ maybeSingle: () => Promise.resolve({ data: id ? { id } : null }) }),
    }),
  });
}

describe("middleware — rota do painel exige sessão (ORD-16)", () => {
  beforeEach(() => {
    getUser.mockReset();
    from.mockReset();
  });

  it("sem sessão em /painel/pedidos → redireciona para /login?next=/painel/pedidos", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { middleware } = await import("../middleware");

    const res = await middleware(makeRequest("/painel/pedidos"));

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/painel/pedidos");
  });

  it("com sessão e loja criada → /painel/pedidos segue sem redirect", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    storeFound("store-1");
    const { middleware } = await import("../middleware");

    const res = await middleware(makeRequest("/painel/pedidos"));

    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
  });
});
