// Shared limiter instances + a helper that turns a rejection into a 429 response.
import { RATE_LIMITS } from "./constants";
import { getIp, jsonError } from "./http";
import { RateLimiter } from "./rateLimit";

const g = globalThis as unknown as { __leftoversLimiters?: Record<keyof typeof RATE_LIMITS, RateLimiter> };
// Keep limiters across dev hot-reloads.
const limiters = (g.__leftoversLimiters ??= {
  createPost: new RateLimiter(RATE_LIMITS.createPost),
  aiExtract: new RateLimiter(RATE_LIMITS.aiExtract),
  signal: new RateLimiter(RATE_LIMITS.signal),
});

/** Returns a 429 Response if limited, otherwise null. */
export function enforceRateLimit(req: Request, bucket: keyof typeof RATE_LIMITS): Response | null {
  const res = limiters[bucket].check(getIp(req));
  if (res.ok) return null;
  const r = jsonError(429, "rate_limited", `Too many requests — try again in ${res.retryAfterSec}s`, {
    retryAfterSec: res.retryAfterSec,
  });
  r.headers.set("Retry-After", String(res.retryAfterSec));
  return r;
}
