import { parseGermanDateStr } from "@/lib/date-de";

/**
 * KW-/Datums-/Std.-Block wie in der bisherigen Rechnungsvorlage (ohne Tätigkeitstext).
 */
export function buildPositionText(
  kw: number,
  dates: Date[],
  totalHours: number,
): string {
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const dayStrings = sorted.map((d, i) => {
    const isLastOfMonth =
      i === sorted.length - 1 || sorted[i + 1]!.getMonth() !== d.getMonth();
    return isLastOfMonth
      ? `${d.getDate()}.${d.getMonth() + 1}.`
      : `${d.getDate()}.`;
  });
  const hoursFormatted = totalHours.toFixed(1).replace(".", ",");
  return `KW${kw}: ${dayStrings.join(", ")}: = ${hoursFormatted} Std.`;
}

export function datesDisplayStringsToDates(dates: string[]): Date[] {
  const out: Date[] = [];
  for (const s of dates) {
    const d = parseGermanDateStr(s);
    if (d) out.push(d);
  }
  return out.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Finaler Spezifikationstext für DOCX/Vorschau: nur Tätigkeit oder Tätigkeit + KW-/Datumsblock.
 */
export function buildSpecificationForExport(
  activityLabel: string,
  includeKwDateBlock: boolean,
  kw: number,
  datesDisplay: string[],
  effectiveHours: number,
): string {
  const trimmed = activityLabel.trim();
  if (!includeKwDateBlock) return trimmed;
  const dd = datesDisplayStringsToDates(datesDisplay);
  if (dd.length === 0 || effectiveHours <= 0)
    return trimmed;
  const block = buildPositionText(kw, dd, effectiveHours);
  return trimmed ? `${trimmed}\n${block}` : block;
}
