import { describe, it, expect } from 'vitest';
import { validateContact } from './validate';

describe('validateContact', () => {
  it('accepts a well-formed submission and trims fields', () => {
    const r = validateContact({ name: '  Ada  ', email: 'ada@example.com', message: ' Hello ' });
    expect(r.valid).toBe(true);
    expect(r.data).toEqual({ name: 'Ada', email: 'ada@example.com', message: 'Hello' });
  });

  it('rejects missing name, bad email, and empty message', () => {
    const r = validateContact({ name: '', email: 'not-an-email', message: '' });
    expect(r.valid).toBe(false);
    expect(r.errors.name).toBeTruthy();
    expect(r.errors.email).toBeTruthy();
    expect(r.errors.message).toBeTruthy();
    expect(r.data).toBeUndefined();
  });

  it('rejects an over-long message', () => {
    const r = validateContact({ name: 'Ada', email: 'ada@example.com', message: 'x'.repeat(5001) });
    expect(r.valid).toBe(false);
    expect(r.errors.message).toBeTruthy();
  });

  it('handles non-string inputs without throwing', () => {
    const r = validateContact({ name: 123, email: null, message: undefined });
    expect(r.valid).toBe(false);
  });
});
