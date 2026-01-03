export function normalizeMerchant(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  let s = raw.toLowerCase().trim();
  if (!s) return undefined;

  // Remove common punctuation/symbol noise.
  s = s.replace(/[*#@]/g, " ");
  s = s.replace(/[.,/\\'"()]/g, " ");

  // Strip common suffix noise.
  s = s.replace(/\b(inc|llc|co|corp|ltd|company)\b/g, " ");

  // Collapse whitespace.
  s = s.replace(/\s+/g, " ").trim();
  return s || undefined;
}
