import { NextResponse } from "next/server";
import JSZip from "jszip";
import { parseCsv } from "@/lib/csv-parser";
import { buildInvoiceDocx } from "@/lib/invoice-builder";
import { docxToPdf } from "@/lib/pdf-converter";
import type { OutputFormat } from "@/types/invoice";

export const runtime = "nodejs";
export const maxDuration = 120;

function safeFilenamePart(s: string): string {
  return s.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "Rechnung";
}

/**
 * POST multipart: csv (mehrfach), invoiceNumber, date (ISO), projectTitle, outputFormat
 */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const invoiceNumber = String(formData.get("invoiceNumber") ?? "").trim();
    const dateRaw = String(formData.get("date") ?? "");
    const projectTitle = String(formData.get("projectTitle") ?? "").trim();
    const outputFormat = String(formData.get("outputFormat") ?? "docx") as OutputFormat;

    const files = formData.getAll("csv") as File[];

    if (!invoiceNumber) {
      return NextResponse.json(
        { ok: false, error: "Rechnungsnummer fehlt." },
        { status: 400 },
      );
    }
    if (!projectTitle) {
      return NextResponse.json(
        { ok: false, error: "Projekttitel fehlt." },
        { status: 400 },
      );
    }
    if (files.length === 0 || files.length > 4) {
      return NextResponse.json(
        { ok: false, error: "1–4 CSV-Dateien erforderlich." },
        { status: 400 },
      );
    }

    const invoiceDate = new Date(dateRaw);
    if (Number.isNaN(invoiceDate.getTime())) {
      return NextResponse.json(
        { ok: false, error: "Ungültiges Datum." },
        { status: 400 },
      );
    }

    if (!["docx", "pdf", "both"].includes(outputFormat)) {
      return NextResponse.json(
        { ok: false, error: "Ungültiges Ausgabeformat." },
        { status: 400 },
      );
    }

    const positions = [];
    for (const file of files) {
      const text = await file.text();
      positions.push(parseCsv(text));
    }

    const docxBuffer = await buildInvoiceDocx({
      invoiceNumber,
      invoiceDate,
      projectTitle,
      positions,
    });

    const base = safeFilenamePart(`Rechnung-${invoiceNumber}`);

    if (outputFormat === "docx") {
      return new NextResponse(new Uint8Array(docxBuffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${base}.docx"`,
        },
      });
    }

    if (outputFormat === "pdf") {
      const pdfBuffer = await docxToPdf(docxBuffer);
      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${base}.pdf"`,
        },
      });
    }

    const pdfBuffer = await docxToPdf(docxBuffer);
    const zip = new JSZip();
    zip.file(`${base}.docx`, docxBuffer);
    zip.file(`${base}.pdf`, pdfBuffer);
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${base}.zip"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
    console.error("[generate]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
