import { describe, it, expect } from 'vitest';
import { RateLimiter } from './rateLimit';

describe('RateLimiter', () => {
  it('allows up to the limit then blocks within the window', () => {
    const rl = new RateLimiter(2, 1000);
    expect(rl.allow('ip1', 0)).toBe(true);
    expect(rl.allow('ip1', 100)).toBe(true);
    expect(rl.allow('ip1', 200)).toBe(false);
  });

  it('resets after the window elapses', () => {
    const rl = new RateLimiter(1, 1000);
    expect(rl.allow('ip1', 0)).toBe(true);
    expect(rl.allow('ip1', 500)).toBe(false);
    expect(rl.allow('ip1', 1001)).toBe(true);
  });

  it('tracks keys independently', () => {
    const rl = new RateLimiter(1, 1000);
    expect(rl.allow('ip1', 0)).toBe(true);
    expect(rl.allow('ip2', 0)).toBe(true);
  });
});
