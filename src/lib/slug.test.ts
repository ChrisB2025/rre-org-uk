import { describe, it, expect } from 'vitest';
import { slugify, uniqueSlugs } from './slug';

describe('slugify', () => {
  it('lowercases and hyphenates, dropping punctuation', () => {
    expect(slugify('Balance of Payments (BOP)')).toBe('balance-of-payments-bop');
    expect(slugify('Money, M0, M1, M2, M3')).toBe('money-m0-m1-m2-m3');
    expect(slugify('(Gross) Value Added')).toBe('gross-value-added');
    expect(slugify('Elasticity/elasticities')).toBe('elasticity-elasticities');
  });

  it('spells out ampersands and strips accents', () => {
    expect(slugify('Debt & Deficit')).toBe('debt-and-deficit');
    expect(slugify('Café économie')).toBe('cafe-economie');
  });
});

describe('uniqueSlugs', () => {
  it('suffixes repeated slugs, leaving the first bare', () => {
    expect(uniqueSlugs(['Deficit', 'Credit', 'Deficit', 'deficit'])).toEqual([
      'deficit',
      'credit',
      'deficit-2',
      'deficit-3',
    ]);
  });

  it('falls back when a term has no usable characters', () => {
    expect(uniqueSlugs(['—'])).toEqual(['entry']);
  });
});
