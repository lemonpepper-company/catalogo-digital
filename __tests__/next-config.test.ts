import { describe, it, expect, vi, afterEach } from "vitest";

type RemotePattern = { protocol: string; hostname: string };

async function loadConfig(supabaseUrl: string) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl);
  const mod = await import("@/next.config.mjs");
  const patterns = mod.default.images.remotePatterns as RemotePattern[];
  return patterns;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("next.config image remotePatterns", () => {
  it("uses http for a local (http) Supabase URL", async () => {
    const patterns = await loadConfig("http://127.0.0.1:54321");
    const supa = patterns.find((p) => p.hostname === "127.0.0.1");
    expect(supa).toBeDefined();
    expect(supa!.protocol).toBe("http");
  });

  it("uses https for a remote (https) Supabase URL", async () => {
    const patterns = await loadConfig("https://abc.supabase.co");
    const supa = patterns.find((p) => p.hostname === "abc.supabase.co");
    expect(supa).toBeDefined();
    expect(supa!.protocol).toBe("https");
  });
});

async function loadCsp(nodeEnv: string) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
  vi.stubEnv("NODE_ENV", nodeEnv);
  const mod = await import("@/next.config.mjs");
  const headersFn = mod.default.headers as () => Promise<
    { source: string; headers: { key: string; value: string }[] }[]
  >;
  const [{ headers }] = await headersFn();
  return headers.find((h) => h.key === "Content-Security-Policy")!.value;
}

describe("next.config Content-Security-Policy", () => {
  it("inclui unsafe-eval em desenvolvimento (necessário para HMR/React DevTools)", async () => {
    const csp = await loadCsp("development");
    expect(csp).toContain("'unsafe-eval'");
  });

  it("não inclui unsafe-eval em produção", async () => {
    const csp = await loadCsp("production");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it("permite o host do Supabase em img-src e connect-src", async () => {
    const csp = await loadCsp("production");
    expect(csp).toContain("img-src 'self' data: https://images.unsplash.com https://abc.supabase.co");
    expect(csp).toContain("https://abc.supabase.co wss://abc.supabase.co");
  });
});

async function loadSecurityHeaders() {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
  const mod = await import("@/next.config.mjs");
  const headersFn = mod.default.headers as () => Promise<
    { source: string; headers: { key: string; value: string }[] }[]
  >;
  const [{ headers }] = await headersFn();
  return Object.fromEntries(headers.map((h) => [h.key, h.value]));
}

describe("next.config security headers", () => {
  it("define os headers HTTP essenciais", async () => {
    const headers = await loadSecurityHeaders();
    expect(headers["X-Frame-Options"]).toBe("SAMEORIGIN");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toBe("camera=(), microphone=(), geolocation=()");
    expect(headers["Strict-Transport-Security"]).toBe("max-age=63072000; includeSubDomains");
  });
});
