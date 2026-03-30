import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { addDays, format } from "date-fns";
import { de } from "date-fns/locale";
import type { InvoicePosition } from "@/types/invoice";
import { formatDeCurrency, formatDeDecimal } from "@/lib/format-de";
import { invoiceTemplate } from "@/lib/invoice-template";

export type BuildInvoiceInput = {
  invoiceNumber: string;
  invoiceDate: Date;
  projectTitle: string;
  positions: InvoicePosition[];
};

const thinBorder = {
  style: BorderStyle.SINGLE,
  size: 1,
  color: "666666",
};

function cellPara(
  text: string,
  opts?: { bold?: boolean; size?: number },
): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    children: [
      new TextRun({
        text,
        bold: opts?.bold,
        size: opts?.size ? opts.size * 2 : undefined,
      }),
    ],
  });
}

function tableCell(
  text: string,
  widthPct: number,
  bold?: boolean,
): TableCell {
  return new TableCell({
    borders: {
      top: thinBorder,
      bottom: thinBorder,
      left: thinBorder,
      right: thinBorder,
    },
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    children: [cellPara(text, { bold })],
  });
}

function lineNet(p: InvoicePosition): number {
  return p.totalHours * p.rate;
}

/**
 * Erzeugt die Rechnung als DOCX (docx-Paket).
 */
export async function buildInvoiceDocx(input: BuildInvoiceInput): Promise<Buffer> {
  const { invoiceNumber, invoiceDate, projectTitle, positions } = input;
  if (positions.length === 0) {
    throw new Error("Mindestens eine Position (CSV) erforderlich.");
  }

  const t = invoiceTemplate;
  const dateStr = format(invoiceDate, "dd.MM.yyyy", { locale: de });
  const payUntil = format(addDays(invoiceDate, 10), "dd.MM.yyyy", {
    locale: de,
  });

  let netSum = 0;
  for (const p of positions) {
    netSum += lineNet(p);
  }
  const vat = netSum * (t.vatRatePercent / 100);
  const gross = netSum + vat;

  const headerBlock: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({ text: t.issuer.name, bold: true, size: 28 }),
      ],
    }),
    ...t.issuer.addressLines.map(
      (line) =>
        new Paragraph({
          children: [new TextRun({ text: line, size: 22 })],
        }),
    ),
    new Paragraph({ text: "" }),
    new Paragraph({
      children: [
        new TextRun({ text: t.customer.name, bold: true, size: 24 }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `${t.customer.street}`, size: 22 }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: t.customer.zipCity, size: 22 }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${t.customer.vatIdLabel} ${t.customer.vatId}    ${t.customer.customerNoLabel} ${t.customer.customerNo}`,
          size: 20,
        }),
      ],
    }),
    new Paragraph({ text: "" }),
    new Paragraph({
      children: [
        new TextRun({ text: `Datum: ${dateStr}`, size: 22 }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Rechnungs-Nr.: ${invoiceNumber}    Projekt: ${projectTitle}`,
          size: 22,
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${t.contact.label} ${t.contact.person}  ${t.contact.telLabel} ${t.contact.tel}  ${t.contact.mailLabel} ${t.contact.mail}`,
          size: 20,
        }),
      ],
    }),
    new Paragraph({ text: "" }),
    new Paragraph({
      children: [new TextRun({ text: t.introParagraph, size: 22 })],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${t.serviceLinePrefix} ${projectTitle}`,
          size: 22,
        }),
      ],
    }),
    new Paragraph({ text: "" }),
  ];

  const headerRow = new TableRow({
    children: [
      tableCell("Pos", 8, true),
      tableCell("Anzahl Std.", 12, true),
      tableCell("LE", 8, true),
      tableCell("Spezifikation", 40, true),
      tableCell("EP €", 12, true),
      tableCell("GP € netto", 20, true),
    ],
  });

  const dataRows: TableRow[] = positions.map((pos, i) => {
    const net = lineNet(pos);
    const spec = `Lieferungs- und Leistungsdatum: ${pos.positionText}`;
    return new TableRow({
      children: [
        tableCell(String(i + 1).padStart(2, "0"), 8),
        tableCell(formatDeDecimal(pos.totalHours, 1), 12),
        tableCell(t.leLabel, 8),
        tableCell(spec, 40),
        tableCell(formatDeCurrency(pos.rate), 12),
        tableCell(formatDeCurrency(net), 20),
      ],
    });
  });

  const totalsParas: Paragraph[] = [
    new Paragraph({ text: "" }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Zwischensumme netto: ${formatDeCurrency(netSum)}`,
          size: 22,
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${t.vatRatePercent} % MwSt.: ${formatDeCurrency(vat)}`,
          size: 22,
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Bruttobetrag: ${formatDeCurrency(gross)}`,
          bold: true,
          size: 24,
        }),
      ],
    }),
    new Paragraph({ text: "" }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Zahlungsziel: ${payUntil} (${formatDeDecimal(10, 0)} Tage netto)`,
          size: 22,
        }),
      ],
    }),
  ];

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [...headerBlock, table, ...totalsParas],
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  return Buffer.from(buf);
}
