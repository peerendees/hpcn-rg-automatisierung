import { readFileSync } from "node:fs";
import { join } from "node:path";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { addDays, format } from "date-fns";
import { de } from "date-fns/locale";
import type { InvoicePosition } from "@/types/invoice";
import { formatDeDecimal } from "@/lib/format-de";
import { invoiceTemplate } from "@/lib/invoice-template";

export type BuildInvoiceInput = {
  invoiceNumber: string;
  invoiceDate: Date;
  projectTitle: string;
  positions: InvoicePosition[];
};

function lineNet(p: InvoicePosition): number {
  return p.totalHours * p.rate;
}

function loadTemplateBuffer(): Buffer {
  const p = join(process.cwd(), "assets", "templates", "invoice-template.docx");
  return readFileSync(p);
}

/**
 * Erzeugt die Rechnung als DOCX aus der Word-Vorlage (Grafiken, Tabellenbreiten, Styles).
 */
export async function buildInvoiceDocx(input: BuildInvoiceInput): Promise<Buffer> {
  const { invoiceNumber, invoiceDate, projectTitle, positions } = input;
  if (positions.length === 0) {
    throw new Error("Mindestens eine Position (CSV) erforderlich.");
  }

  const vatRate = invoiceTemplate.vatRatePercent / 100;
  let netSum = 0;
  for (const p of positions) {
    netSum += lineNet(p);
  }
  const vat = netSum * vatRate;
  const gross = netSum + vat;
  const payUntil = format(addDays(invoiceDate, 10), "dd.MM.yyyy", {
    locale: de,
  });

  const zip = new PizZip(loadTemplateBuffer());
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  doc.render({
    invoiceDate: format(invoiceDate, "dd.MM.yyyy", { locale: de }),
    invoiceNumber,
    projectTitle,
    netTotal: formatDeDecimal(netSum, 2),
    vatAmount: formatDeDecimal(vat, 2),
    grossTotal: formatDeDecimal(gross, 2),
    payUntil,
    positions: positions.map((p, i) => ({
      pos: String(i + 1).padStart(2, "0"),
      hours: formatDeDecimal(p.totalHours, 1),
      le: invoiceTemplate.leLabel,
      spec: `Lieferungs- und Leistungsdatum: ${p.positionText}`,
      ep: formatDeDecimal(p.rate, 2),
      gp: formatDeDecimal(lineNet(p), 2),
    })),
  });
  return doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  }) as Buffer;
}
