import Papa from "papaparse";
import { getISOWeek, getISOWeekYear } from "date-fns";
import type { InvoicePosition } from "@/types/invoice";
import { invoiceTemplate } from "@/lib/invoice-template";

type Row = Record<string, string>;

/** BOM / Whitespace am Anfang; Zeilenenden vereinheitlichen (Upload von macOS/Windows). */
function normalizeCsvText(content: string): string {
  return content
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

/** Excel/Export: erste Spalte heißt ggf. "\ufefftype" statt "type". */
function normalizeRowKeys(row: Row): Row {
  const o: Row = {};
  for (const [k, v] of Object.entries(row)) {
    const key = k.replace(/^\uFEFF/, "").trim();
    o[key] = v == null ? "" : String(v);
  }
  return o;
}

function rowHasAnyValue(row: Row): boolean {
  return Object.values(row).some((v) => String(v).trim() !== "");
}

function getCell(row: Row, ...names: string[]): string {
  const keys = Object.keys(row);
  for (const name of names) {
    const hit = keys.find((k) => k.toLowerCase() === name.toLowerCase());
    if (hit !== undefined) return (row[hit] ?? "").trim();
  }
  return "";
}

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

function detectMinuteBased(rows: Row[], durationKey: string): boolean {
  const nums: number[] = [];
  for (const row of rows) {
    const raw = getCell(row, durationKey);
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

function parsePapa(text: string, delimiter: string | undefined): Papa.ParseResult<Row> {
  return Papa.parse<Row>(text, {
    header: true,
    delimiter: delimiter ?? "",
    skipEmptyLines: true,
  });
}

function extractDataRows(parsed: Papa.ParseResult<Row>): Row[] {
  const raw = parsed.data.map(normalizeRowKeys);
  return raw.filter(rowHasAnyValue);
}

/**
 * Parst semikolon-separiertes CSV (Zeiterfassung) zu einer Rechnungsposition.
 */
export function parseCsv(content: string): InvoicePosition {
  const text = normalizeCsvText(content);
  if (!text) {
    throw new Error("CSV-Datei ist leer.");
  }

  let parsed = parsePapa(text, ";");
  if (parsed.errors.length > 0) {
    const msg = parsed.errors.map((e) => e.message).join("; ");
    throw new Error(`CSV-Parse-Fehler: ${msg}`);
  }

  let rows = extractDataRows(parsed);

  // Fallback: Auto-Delimiter (z. B. anderes Trennzeichen oder BOM-Probleme)
  if (rows.length === 0) {
    parsed = parsePapa(text, undefined);
    if (parsed.errors.length > 0) {
      const msg = parsed.errors.map((e) => e.message).join("; ");
      throw new Error(`CSV-Parse-Fehler: ${msg}`);
    }
    rows = extractDataRows(parsed);
  }

  if (rows.length === 0) {
    const preview = text.slice(0, 120).replace(/\n/g, "\\n");
    throw new Error(
      `CSV enthält keine Datenzeilen (nach Header). Vorschau: ${preview}${text.length > 120 ? "…" : ""}`,
    );
  }

  const durationKey = "duration";
  const dateKey = "date";

  const fileUsesMinutes = detectMinuteBased(rows, durationKey);

  let totalHours = 0;
  const dateSet = new Map<number, Date>();

  for (const row of rows) {
    totalHours += parseDurationCell(
      getCell(row, durationKey),
      fileUsesMinutes,
    );
    const ds = getCell(row, dateKey);
    const d = parseGermanDateStr(ds);
    if (d) dateSet.set(d.getTime(), d);
  }

  const uniqueDates = [...dateSet.values()].sort(
    (a, b) => a.getTime() - b.getTime(),
  );
  if (uniqueDates.length === 0) {
    throw new Error(
      "Keine gültigen Datumsangaben in der Spalte date (Format TT.MM.JJ).",
    );
  }

  const anchor = uniqueDates[0]!;
  const kw = getISOWeek(anchor);
  const year = getISOWeekYear(anchor);

  const rate = invoiceTemplate.prototypeHourlyRate;

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
