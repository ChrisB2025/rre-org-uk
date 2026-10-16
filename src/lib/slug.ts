/** Turn a heading or term into a URL fragment, e.g. "Balance of Payments (BOP)" -> "balance-of-payments-bop". */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Slugify each text, suffixing repeats (-2, -3, ...) so every id is unique on the page.
 * Order matters: the first occurrence keeps the bare slug, so existing links stay stable.
 */
export function uniqueSlugs(texts: string[]): string[] {
  const seen = new Map<string, number>();
  return texts.map((text) => {
    const base = slugify(text) || 'entry';
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base}-${count}`;
  });
}
