import Papa from "papaparse";
import { getISOWeek, getISOWeekYear } from "date-fns";
import type { CsvParseResult, ParsedCsvPositionRow } from "@/types/invoice";
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

/** Pflicht-Spalten (nach Header-Faltung). Positions-/Tätigkeitstext: Spalte „Tätigkeit“ oder gleiche Bedeutung als „note“ (Zeiterfassung); nicht „task“. */
const REQUIRED_BASE_FOLDS = ["datum", "kunde", "von", "bis"] as const;

const BASE_FOLD_LABEL: Record<(typeof REQUIRED_BASE_FOLDS)[number], string> = {
  datum: "Datum",
  kunde: "Kunde",
  von: "Von",
  bis: "Bis",
};

type CanonicalFive = {
  datum: string;
  kunde: string;
  tatigkeit: string;
  von: string;
  bis: string;
};

function buildCanonicalRow(row: Row, fields: string[]): CanonicalFive {
  let datum = "";
  let kunde = "";
  let tatigkeitCol = "";
  let noteCol = "";
  let von = "";
  let bis = "";
  for (const f of fields) {
    const fold = foldHeader(f);
    const raw = String(row[f] ?? "").trim();
    if (fold === "datum") datum = raw;
    else if (fold === "kunde") kunde = raw;
    else if (fold === "von") von = raw;
    else if (fold === "bis") bis = raw;
    else if (fold === "tatigkeit") tatigkeitCol = raw;
    else if (fold === "note") noteCol = raw;
  }
  /** note hat Vorrang (typischer Export); sonst explizite Spalte Tätigkeit. */
  const tatigkeit = noteCol || tatigkeitCol;
  return { datum, kunde, tatigkeit, von, bis };
}

function validateHeaders(fields: string[] | undefined): void {
  if (!fields?.length) {
    throw new Error("CSV ohne Headerzeile.");
  }
  const folds = new Set(fields.map((f) => foldHeader(f)));
  const missingLabels: string[] = [];
  for (const k of REQUIRED_BASE_FOLDS) {
    if (!folds.has(k)) missingLabels.push(BASE_FOLD_LABEL[k]);
  }
  const hasActivityText = folds.has("note") || folds.has("tatigkeit");
  if (!hasActivityText) {
    missingLabels.push("Tätigkeit oder note");
  }
  if (missingLabels.length > 0) {
    throw new Error(
      `Unbekanntes oder unvollständiges CSV-Format. Erwartete Spalten: Datum, Kunde, Von, Bis sowie Tätigkeit — Rohdaten oft als Spalte „note“ exportiert (Delimiter automatisch). Fehlend: ${missingLabels.join(", ")}.`,
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

function tryExtractSumHours(row: Row, fields: string[]): number | null {
  for (let i = fields.length - 1; i >= 0; i--) {
    const key = fields[i]!;
    const raw = String(row[key] ?? "").trim();
    const n = parseDeDecimal(raw);
    if (n !== null && n >= 0 && n < 50000) return n;
  }
  return null;
}

function fmtDeHour(n: number): string {
  return n.toFixed(2).replace(".", ",");
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
 * HPCN-CSV: Datum | Kunde | Tätigkeit | Von | Bis (+ Summenzeile).
 * Tätigkeitstext kann im Rohexport unter „note“ stehen (gleiche Spalte semantisch).
 * Pro Datenzeile eine Position; Abweichung Summenzeile vs. Von/Bis nur als sumWarning.
 */
export function parseCsv(content: string): CsvParseResult {
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
    declaredSum = tryExtractSumHours(sumRowRaw, fields);
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

  let sumWarning: string | null = null;
  if (sumIndex >= 0 && sumRowRaw) {
    if (declaredSum === null) {
      sumWarning =
        "Summenzeile erkannt, aber keine auslesbare Stundenzahl (z. B. 24 oder 24,0).";
    } else {
      const tol = 0.05;
      if (Math.abs(computedSum - declaredSum) > tol) {
        const diff = computedSum - declaredSum;
        sumWarning = `Summenabgleich: Summe Von/Bis = ${fmtDeHour(computedSum)} h, Summenzeile = ${fmtDeHour(declaredSum)} h (Differenz ${fmtDeHour(diff)} h). Bitte prüfen.`;
      }
    }
  }

  return { rows: positions, sumWarning };
}
