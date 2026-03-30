import Papa from "papaparse";
import { getISOWeek, getISOWeekYear } from "date-fns";
import type { InvoicePosition } from "@/types/invoice";

const RATE_FALLBACK = 70;

type Row = Record<string, string>;

/** Summiert duration-Werte zu Stunden (CSV: Minuten, HH:MM:SS oder Dezimal-Stunden). */
function parseDurationCell(raw: string, fileUsesMinutes: boolean): number {
  const s = raw.trim();
  if (!s) return 0;

  if (s.includes(":")) {
    const parts = s.split(":").map((p) => parseInt(p, 10));
    if (parts.some((n) => Number.isNaN(n))) return 0;
    const h = parts[0] ?? 0;
    const m = parts[1] ?? 0;
    const sec = parts[2] ?? 0;
    return h + m / 60 + sec / 3600;
  }

  const n = parseFloat(s.replace(",", "."));
  if (Number.isNaN(n)) return 0;
  if (fileUsesMinutes) return n / 60;
  return n;
}

/** Erkennt, ob numerische Durations in Minuten vorliegen (Export wie hpcn-Zeiterfassung). */
function detectMinuteBased(rows: Row[], durationKey: string): boolean {
  const nums: number[] = [];
  for (const row of rows) {
    const raw = row[durationKey]?.trim() ?? "";
    if (!raw || raw.includes(":")) continue;
    const n = parseFloat(raw.replace(",", "."));
    if (!Number.isNaN(n)) nums.push(n);
  }
  if (nums.length === 0) return false;
  const maxVal = Math.max(...nums);
  return maxVal > 48;
}

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

export function buildPositionText(
  kw: number,
  dates: Date[],
  totalHours: number,
): string {
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const dayStrings = sorted.map((d, i) => {
    const isLastOfMonth =
      i === sorted.length - 1 ||
      sorted[i + 1]!.getMonth() !== d.getMonth();
    return isLastOfMonth
      ? `${d.getDate()}.${d.getMonth() + 1}.`
      : `${d.getDate()}.`;
  });
  const hoursFormatted = totalHours.toFixed(1).replace(".", ",");
  return `KW${kw}: ${dayStrings.join(", ")}: = ${hoursFormatted} Std.`;
}

/**
 * Parst semikolon-separiertes CSV (Zeiterfassung) zu einer Rechnungsposition.
 */
export function parseCsv(content: string): InvoicePosition {
  const parsed = Papa.parse<Row>(content, {
    header: true,
    delimiter: ";",
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    const msg = parsed.errors.map((e) => e.message).join("; ");
    throw new Error(`CSV-Parse-Fehler: ${msg}`);
  }

  const rows = parsed.data.filter((r) =>
    Object.values(r).some((v) => String(v).trim() !== ""),
  );
  if (rows.length === 0) {
    throw new Error("CSV enthält keine Datenzeilen.");
  }

  const durationKey = "duration";
  const dateKey = "date";
  const rateKey = "rate";

  const fileUsesMinutes = detectMinuteBased(rows, durationKey);

  let totalHours = 0;
  const dateSet = new Map<number, Date>();

  for (const row of rows) {
    totalHours += parseDurationCell(row[durationKey] ?? "", fileUsesMinutes);
    const ds = row[dateKey]?.trim() ?? "";
    const d = parseGermanDateStr(ds);
    if (d) dateSet.set(d.getTime(), d);
  }

  const uniqueDates = [...dateSet.values()].sort(
    (a, b) => a.getTime() - b.getTime(),
  );
  if (uniqueDates.length === 0) {
    throw new Error("Keine gültigen Datumsangaben in der Spalte date.");
  }

  const anchor = uniqueDates[0]!;
  const kw = getISOWeek(anchor);
  const year = getISOWeekYear(anchor);

  const rateRaw = rows[0]?.[rateKey]?.trim();
  const rateParsed = rateRaw ? parseFloat(rateRaw.replace(",", ".")) : NaN;
  const rate = Number.isFinite(rateParsed) ? rateParsed : RATE_FALLBACK;

  const positionText = buildPositionText(kw, uniqueDates, totalHours);

  return {
    kw,
    year,
    totalHours,
    dates: uniqueDates.map(
      (d) =>
        `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getFullYear()).slice(-2)}`,
    ),
    rate,
    positionText,
  };
}
