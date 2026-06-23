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
