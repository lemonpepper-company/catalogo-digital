import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let ratelimit: Ratelimit | null | undefined;

function getRatelimit(): Ratelimit | null {
  if (ratelimit !== undefined) return ratelimit;

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    // Upstash ainda não provisionado (Vercel Marketplace) — rate limit fica desativado.
    ratelimit = null;
    return ratelimit;
  }

  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, "10 s"),
    prefix: "ratelimit",
  });
  return ratelimit;
}

export async function checkRateLimit(identifier: string): Promise<boolean> {
  const limiter = getRatelimit();
  if (!limiter) return true;

  const { success } = await limiter.limit(identifier);
  return success;
}
