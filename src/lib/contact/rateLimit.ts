interface Hit {
  count: number;
  resetAt: number;
}

/**
 * In-memory per-key rate limiter. Best effort only: state lives in the single
 * Railway instance's memory and is not durable. Used to blunt abuse, not for
 * correctness.
 */
export class RateLimiter {
  private hits = new Map<string, Hit>();

  constructor(private limit = 5, private windowMs = 10 * 60 * 1000) {}

  /** Returns true if the request is allowed; false if `key` is over the limit. */
  allow(key: string, now: number): boolean {
    const hit = this.hits.get(key);
    if (!hit || now >= hit.resetAt) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (hit.count >= this.limit) return false;
    hit.count += 1;
    return true;
  }
}
