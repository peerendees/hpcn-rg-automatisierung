/** DD.MM.YY oder DD.MM.YYYY → Date (lokal, Mittag wegen DST). */
export function parseGermanDateStr(s: string): Date | null {
  const t = s.trim();
  const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (!m) return null;
  const dd = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  let yy = parseInt(m[3], 10);
  if (yy < 100) yy += 2000;
  const d = new Date(yy, mm - 1, dd, 12, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}
