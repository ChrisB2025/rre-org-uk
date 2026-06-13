import { describe, it, expect } from 'vitest';
import { isHoneypotTripped, isTooFast } from './antispam';

describe('isHoneypotTripped', () => {
  it('is true when the honeypot field has content', () => {
    expect(isHoneypotTripped({ company: 'Acme' })).toBe(true);
  });
  it('is false when empty or absent', () => {
    expect(isHoneypotTripped({ company: '   ' })).toBe(false);
    expect(isHoneypotTripped({})).toBe(false);
  });
});

describe('isTooFast', () => {
  it('is true when submitted under the threshold after render', () => {
    expect(isTooFast(1000, 1500, 2000)).toBe(true);
  });
  it('is false when enough time has passed', () => {
    expect(isTooFast(1000, 5000, 2000)).toBe(false);
  });
  it('skips the check (false) when no timestamp is present (no-JS)', () => {
    expect(isTooFast(null, 5000, 2000)).toBe(false);
    expect(isTooFast(Number.NaN, 5000, 2000)).toBe(false);
  });
});
