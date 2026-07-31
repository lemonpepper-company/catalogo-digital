import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

const getUser = vi.fn();
const from = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser }, from }),
}));

const rpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createAnonClient: () => ({ rpc }),
}));

function makeDomainRequest(host: string) {
  const request = new NextRequest("http://localhost:3000/");
  Object.defineProperty(request, "headers", {
    value: new Headers({ host }),
    configurable: true,
  });
  return request;
}

function domainResolves(
  row: { store_slug: string; domain_verified: boolean; effective_plan: string } | null
) {
  rpc.mockResolvedValue({ data: row ? [row] : [], error: null });
}

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

describe("middleware — domínio próprio e plano", () => {
  beforeEach(() => {
    rpc.mockReset();
    process.env.NEXT_PUBLIC_SITE_URL = "https://vtrine.com.br";
  });

  it("plano com domínio próprio → rewrite transparente para a vitrine", async () => {
    domainResolves({
      store_slug: "atelie-mira",
      domain_verified: true,
      effective_plan: "pro",
    });
    const res = await middleware(makeDomainRequest("atelie-mira.com.br"));
    expect(res.headers.get("x-middleware-rewrite")).toContain("/atelie-mira");
  });

  it("plano sem domínio próprio → redirect 307 para o slug", async () => {
    domainResolves({
      store_slug: "atelie-mira",
      domain_verified: true,
      effective_plan: "starter",
    });
    const res = await middleware(makeDomainRequest("atelie-mira.com.br"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://vtrine.com.br/atelie-mira");
  });

  it("rebaixado para free também redireciona", async () => {
    domainResolves({
      store_slug: "atelie-mira",
      domain_verified: true,
      effective_plan: "free",
    });
    const res = await middleware(makeDomainRequest("atelie-mira.com.br"));
    expect(res.status).toBe(307);
  });

  it("domínio não verificado → rewrite para /dominio-pendente", async () => {
    domainResolves({
      store_slug: "atelie-mira",
      domain_verified: false,
      effective_plan: "pro",
    });
    const res = await middleware(makeDomainRequest("atelie-mira.com.br"));
    expect(res.headers.get("x-middleware-rewrite")).toContain("/dominio-pendente");
  });

  it("host desconhecido → segue o fluxo normal (landing)", async () => {
    domainResolves(null);
    const res = await middleware(makeDomainRequest("dominio-qualquer.com"));
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(res.status).toBe(200);
  });

  it("erro na RPC não derruba o site — segue para a landing", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await middleware(makeDomainRequest("atelie-mira.com.br"));
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(res.status).toBe(200);
  });
});
