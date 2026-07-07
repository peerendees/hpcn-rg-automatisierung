/**
 * Deutsche Dezimalschreibweise (optional mit Tausenderpunkt). Leer/ungültig → null.
 *
 * Punkte werden nur dann als Tausenderpunkte entfernt, wenn ein Komma
 * vorhanden ist oder das Muster eindeutig ist (z. B. „1.234" oder „1.234.567").
 * Ein einzelner Punkt ohne Komma gilt als Dezimaltrenner („1.5" → 1,5).
 */
export function parseDeDecimal(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;

  let normalized: string;
  if (t.includes(",")) {
    // Komma ist Dezimaltrenner, Punkte sind Tausenderpunkte
    normalized = t.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) {
    // Eindeutiges Tausenderpunkt-Muster ohne Komma (z. B. 1.234.567)
    normalized = t.replace(/\./g, "");
  } else {
    // Kein Komma, kein Tausendermuster: Punkt als Dezimaltrenner belassen
    normalized = t;
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}
