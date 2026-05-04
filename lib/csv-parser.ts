import Papa from "papaparse";
import { getISOWeek, getISOWeekYear } from "date-fns";
import type { ParsedCsvPositionRow } from "@/types/invoice";
import { parseGermanDateStr } from "@/lib/date-de";
import { parseDeDecimal } from "@/lib/parse-de-number";

export { parseGermanDateStr } from "@/lib/date-de";

type Row = Record<string, string>;

/** BOM / Whitespace am Anfang; Zeilenenden vereinheitlichen. */
function normalizeCsvText(content: string): string {
  return content
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

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

function foldHeader(k: string): string {
  return k
    .replace(/^\uFEFF/, "")
    .trim()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/** Erwartete Spalten (nach Header-Faltung). */
const REQUIRED_FOLDS = ["datum", "kunde", "tatigkeit", "von", "bis"] as const;

type CanonicalFive = Record<(typeof REQUIRED_FOLDS)[number], string>;

function buildCanonicalRow(row: Row, fields: string[]): CanonicalFive {
  const acc: Partial<CanonicalFive> = {};
  for (const f of fields) {
    const fold = foldHeader(f);
    if (
      fold === "datum" ||
      fold === "kunde" ||
      fold === "tatigkeit" ||
      fold === "von" ||
      fold === "bis"
    ) {
      acc[fold] = String(row[f] ?? "").trim();
    }
  }
  const full = acc as CanonicalFive;
  for (const key of REQUIRED_FOLDS) {
    if (full[key] === undefined) full[key] = "";
  }
  return full;
}

function validateHeaders(fields: string[] | undefined): void {
  if (!fields?.length) {
    throw new Error("CSV ohne Headerzeile.");
  }
  const folds = new Set(fields.map((f) => foldHeader(f)));
  const missing = REQUIRED_FOLDS.filter((k) => !folds.has(k));
  if (missing.length > 0) {
    throw new Error(
      `Unbekanntes oder unvollständiges CSV-Format. Erwartete Spalten: Datum, Kunde, Tätigkeit, Von, Bis (Delimiter automatisch). Fehlend nach Normalisierung: ${missing.join(", ")}.`,
    );
  }
}

function parseHm(raw: string): { h: number; m: number } | null {
  const t = raw.trim();
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1]!, 10);
  const min = parseInt(m[2]!, 10);
  if (Number.isNaN(h) || Number.isNaN(min) || min > 59 || h > 47)
    return null;
  return { h, m: min };
}

/** Stunden aus Von/Bis am selben Kalendertag. */
export function hoursFromVonBis(vonRaw: string, bisRaw: string): number {
  const von = parseHm(vonRaw);
  const bis = parseHm(bisRaw);
  if (!von || !bis) {
    throw new Error(
      `Von/Bis müssen als HH:MM angegeben sein (z. B. 09:30 und 17:00).`,
    );
  }
  const start = von.h + von.m / 60;
  const end = bis.h + bis.m / 60;
  if (end < start) {
    throw new Error(
      "Endzeit liegt vor Startzeit (über Mitternacht aktuell nicht unterstützt).",
    );
  }
  return end - start;
}

function rowHasSumKeyword(row: CanonicalFive): boolean {
  const joined =
    `${row.datum} ${row.kunde} ${row.tatigkeit} ${row.von} ${row.bis}`.toLowerCase();
  return /\b(summe|gesamt|insgesamt)\b/i.test(joined);
}

function extractSumHours(row: Row, fields: string[]): number {
  for (let i = fields.length - 1; i >= 0; i--) {
    const key = fields[i]!;
    const raw = String(row[key] ?? "").trim();
    const n = parseDeDecimal(raw);
    if (n !== null && n >= 0 && n < 50000) return n;
  }
  throw new Error(
    "Summenzeile gefunden, aber keine Stundenzahl erkannt (erwartet z. B. 37,5).",
  );
}

function formatDateShort(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getFullYear()).slice(-2)}`;
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
 * Neues HPCN-CSV: Datum | Kunde | Tätigkeit | Von | Bis (+ Summenzeile).
 * Pro Datenzeile eine Position; Summenzeile wird gegen Summe Von/Bis geprüft.
 */
export function parseCsv(content: string): ParsedCsvPositionRow[] {
  const text = normalizeCsvText(content);
  if (!text) throw new Error("CSV-Datei ist leer.");

  let parsed = parsePapa(text, ";");
  if (parsed.errors.length > 0) {
    const msg = parsed.errors.map((e) => e.message).join("; ");
    throw new Error(`CSV-Parse-Fehler: ${msg}`);
  }

  let rows = extractDataRows(parsed);
  if (rows.length === 0) {
    parsed = parsePapa(text, undefined);
    if (parsed.errors.length > 0) {
      const msg = parsed.errors.map((e) => e.message).join("; ");
      throw new Error(`CSV-Parse-Fehler: ${msg}`);
    }
    rows = extractDataRows(parsed);
  }

  const fields = parsed.meta.fields ?? [];
  validateHeaders(fields);

  if (rows.length === 0) {
    throw new Error("CSV enthält keine Datenzeilen nach dem Header.");
  }

  const canonicalRows = rows.map((r) => buildCanonicalRow(r, fields));

  let sumIndex = -1;
  for (let i = canonicalRows.length - 1; i >= 0; i--) {
    if (rowHasSumKeyword(canonicalRows[i]!)) {
      sumIndex = i;
      break;
    }
  }

  if (sumIndex === -1 && canonicalRows.length >= 1) {
    const last = canonicalRows[canonicalRows.length - 1]!;
    if (!parseGermanDateStr(last.datum)) {
      sumIndex = canonicalRows.length - 1;
    }
  }

  const bodyCanon =
    sumIndex >= 0 ? canonicalRows.slice(0, sumIndex) : [...canonicalRows];
  const sumCanon =
    sumIndex >= 0 ? canonicalRows[sumIndex]! : null;
  const sumRowRaw = sumIndex >= 0 ? rows[sumIndex]! : null;

  let declaredSum: number | null = null;
  if (sumCanon && sumRowRaw) {
    declaredSum = extractSumHours(sumRowRaw, fields);
  }

  const positions: ParsedCsvPositionRow[] = [];
  let computedSum = 0;

  for (let i = 0; i < bodyCanon.length; i++) {
    const c = bodyCanon[i]!;
    const d = parseGermanDateStr(c.datum);
    if (!d) {
      throw new Error(
        `Zeile ${i + 2}: Ungültiges Datum „${c.datum}“ (Format TT.MM.JJ oder TT.MM.JJJJ).`,
      );
    }
    const hrs = hoursFromVonBis(c.von, c.bis);
    computedSum += hrs;
    const kw = getISOWeek(d);
    const year = getISOWeekYear(d);
    positions.push({
      importedHours: hrs,
      activityLabel: c.tatigkeit,
      kw,
      year,
      dates: [formatDateShort(d)],
    });
  }

  if (positions.length === 0) {
    throw new Error("Keine gültigen Datenzeilen mit Datum gefunden.");
  }

  if (declaredSum !== null) {
    const tol = 0.05;
    if (Math.abs(computedSum - declaredSum) > tol) {
      throw new Error(
        `Summenabgleich fehlgeschlagen: Summe Von/Bis = ${computedSum.toFixed(2)} h, in Summenzeile = ${declaredSum.toFixed(2)} h.`,
      );
    }
  }

  return positions;
}
