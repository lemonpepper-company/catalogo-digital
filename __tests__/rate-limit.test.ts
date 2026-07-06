import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const limitMock = vi.fn();

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: Object.assign(
    vi.fn().mockImplementation(() => ({ limit: limitMock })),
    { slidingWindow: vi.fn() }
  ),
}));

vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: vi.fn(() => ({})) },
}));

describe("checkRateLimit", () => {
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  afterEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
    vi.resetModules();
    limitMock.mockReset();
  });

  it("permite tudo quando Upstash não está configurado", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const { checkRateLimit } = await import("../lib/server/rate-limit");

    expect(await checkRateLimit("ip:1")).toBe(true);
    expect(limitMock).not.toHaveBeenCalled();
  });

  it("delega ao Upstash quando configurado", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    limitMock.mockResolvedValue({ success: false });

    const { checkRateLimit } = await import("../lib/server/rate-limit");

    expect(await checkRateLimit("ip:1")).toBe(false);
    expect(limitMock).toHaveBeenCalledWith("ip:1");
  });
});
