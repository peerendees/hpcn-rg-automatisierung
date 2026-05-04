/** Deutsche Dezimalschreibweise (optional mit Tausenderpunkt). Leer → null. */
export function parseDeDecimal(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const normalized = t.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}
