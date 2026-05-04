import type {
  DraftInvoiceLineWire,
  InvoiceApproveCanonical,
  InvoicePosition,
} from "@/types/invoice";
import { buildSpecificationForExport } from "@/lib/invoice-spec";
import { invoiceTemplate } from "@/lib/invoice-template";
import { parseDeDecimal } from "@/lib/parse-de-number";

export function effectiveHoursFromWire(line: DraftInvoiceLineWire): number {
  const raw = (line.overrideHoursText ?? "").trim();
  if (!raw) return line.importedHours;
  const n = parseDeDecimal(raw);
  if (n === null || n < 0 || n > 1e6) {
    throw new Error(
      `Ungültige Überschreib-Stunden: „${raw}“. Erwartet wird eine Zahl (z. B. 7,5).`,
    );
  }
  return n;
}

export function draftLinesToInvoicePositions(
  lines: DraftInvoiceLineWire[],
  includeKwDateBlock: boolean,
): InvoicePosition[] {
  return lines.map((line) => {
    const hours = effectiveHoursFromWire(line);
    const positionText = buildSpecificationForExport(
      line.activityLabel,
      includeKwDateBlock,
      line.kw,
      line.dates,
      hours,
    );
    return {
      kw: line.kw,
      year: line.year,
      totalHours: hours,
      dates: [...line.dates],
      rate: line.rate,
      positionText,
    };
  });
}

/** Kanonisierung vor Hash (stabile Strings/Zahlen). */
export function normalizeApproveCanonical(input: {
  invoiceNumber: string;
  invoiceDate: string;
  projectTitle: string;
  includeKwDateBlock: boolean;
  lines: DraftInvoiceLineWire[];
}): InvoiceApproveCanonical {
  const invoiceNumber = input.invoiceNumber.trim();
  const projectTitle = input.projectTitle.trim();
  const invoiceDate = input.invoiceDate.trim().slice(0, 10);
  const lines = input.lines.map((l) => ({
    importedHours:
      Math.round(l.importedHours * 1000) / 1000,
    overrideHoursText:
      (l.overrideHoursText ?? "").trim() === ""
        ? null
        : (l.overrideHoursText ?? "").trim(),
    activityLabel: l.activityLabel.trim(),
    rate: Math.round(l.rate * 100) / 100,
    rateUserOverride: Boolean(l.rateUserOverride),
    kw: l.kw,
    year: l.year,
    dates: [...l.dates],
  }));
  return {
    invoiceNumber,
    invoiceDate,
    projectTitle,
    includeKwDateBlock: Boolean(input.includeKwDateBlock),
    lines,
  };
}

export function computeTotals(positions: InvoicePosition[]): {
  net: number;
  vat: number;
  gross: number;
} {
  let net = 0;
  for (const p of positions) {
    net += p.totalHours * p.rate;
  }
  const vatRate = invoiceTemplate.vatRatePercent / 100;
  const vat = net * vatRate;
  return { net, vat, gross: net + vat };
}
