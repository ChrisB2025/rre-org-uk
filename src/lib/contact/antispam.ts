/** True if the hidden honeypot field was filled (a real user never sees it). */
export function isHoneypotTripped(raw: Record<string, unknown>, field = 'company'): boolean {
  const v = raw[field];
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * True if the form was submitted suspiciously fast after render.
 * `renderedAt`/`now` are epoch ms. When `renderedAt` is missing/invalid
 * (e.g. a no-JS submission that never set the field) the check is skipped.
 */
export function isTooFast(renderedAt: number | null, now: number, minMs = 2000): boolean {
  if (renderedAt == null || !Number.isFinite(renderedAt) || renderedAt <= 0) return false;
  return now - renderedAt < minMs;
}
