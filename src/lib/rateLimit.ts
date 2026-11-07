// In-memory sliding-window rate limiter. Per server instance → best effort on serverless.
import { RATE_WINDOW_MS } from "./constants";

export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number = RATE_WINDOW_MS,
  ) {}

  /** Records a hit. Returns { ok: true } or { ok: false, retryAfterSec }. */
  check(key: string, now: number = Date.now()): { ok: true } | { ok: false; retryAfterSec: number } {
    const cutoff = now - this.windowMs;
    const arr = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (arr.length >= this.limit) {
      this.hits.set(key, arr);
      const retryAfterSec = Math.max(1, Math.ceil((arr[0]! + this.windowMs - now) / 1000));
      return { ok: false, retryAfterSec };
    }
    arr.push(now);
    this.hits.set(key, arr);
    if (this.hits.size > 10_000) this.prune(cutoff);
    return { ok: true };
  }

  private prune(cutoff: number) {
    for (const [k, v] of this.hits) {
      if (v.every((t) => t <= cutoff)) this.hits.delete(k);
    }
  }
}
