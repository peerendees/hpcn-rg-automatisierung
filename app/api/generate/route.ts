import { NextResponse } from "next/server";
import JSZip from "jszip";
import { buildInvoiceDocx } from "@/lib/invoice-builder";
import { docxToPdf } from "@/lib/pdf-converter";
import type { DraftInvoiceLineWire, OutputFormat } from "@/types/invoice";
import {
  draftLinesToInvoicePositions,
  normalizeApproveCanonical,
} from "@/lib/invoice-draft";
import { sha256CanonicalJson } from "@/lib/canonical-hash";
import {
  getApprovalSecret,
  verifyApprovalToken,
} from "@/lib/approval-token";

export const runtime = "nodejs";
export const maxDuration = 120;

function safeFilenamePart(s: string): string {
  return s.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "Rechnung";
}

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

function dateFromYmd(ymd: string): Date {
  const m = YMD.exec(ymd);
  if (!m) throw new Error("Ungültiges Datum.");
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(y, mo - 1, d, 12, 0, 0, 0);
}

type Body = {
  invoiceNumber?: string;
  invoiceDate?: string;
  projectTitle?: string;
  includeKwDateBlock?: boolean;
  lines?: DraftInvoiceLineWire[];
  outputFormat?: string;
  approvalToken?: string;
};

/**
 * POST JSON: freigegebene Positionen + approvalToken → DOCX / PDF / ZIP
 */
export async function POST(req: Request) {
  try {
    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Ungültiger JSON-Body." },
        { status: 400 },
      );
    }

    const invoiceNumber = String(body.invoiceNumber ?? "").trim();
    const invoiceDateRaw = String(body.invoiceDate ?? "").trim().slice(0, 10);
    const projectTitle = String(body.projectTitle ?? "").trim();
    const includeKwDateBlock = Boolean(body.includeKwDateBlock);
    const lines = body.lines;
    const outputFormat = String(body.outputFormat ?? "docx") as OutputFormat;
    const approvalToken = String(body.approvalToken ?? "").trim();

    if (!approvalToken) {
      return NextResponse.json(
        { ok: false, error: "Freigabe-Token fehlt." },
        { status: 400 },
      );
    }

    if (!invoiceNumber || !projectTitle) {
      return NextResponse.json(
        { ok: false, error: "Rechnungsnummer und Projekttitel erforderlich." },
        { status: 400 },
      );
    }
    if (!YMD.test(invoiceDateRaw)) {
      return NextResponse.json(
        { ok: false, error: "Rechnungsdatum als YYYY-MM-DD erforderlich." },
        { status: 400 },
      );
    }
    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Mindestens eine Rechnungszeile erforderlich." },
        { status: 400 },
      );
    }

    if (!["docx", "pdf", "both"].includes(outputFormat)) {
      return NextResponse.json(
        { ok: false, error: "Ungültiges Ausgabeformat." },
        { status: 400 },
      );
    }

    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i]!;
      if (
        typeof ln.importedHours !== "number" ||
        typeof ln.activityLabel !== "string" ||
        typeof ln.rate !== "number" ||
        typeof ln.rateUserOverride !== "boolean" ||
        typeof ln.kw !== "number" ||
        typeof ln.year !== "number" ||
        !Array.isArray(ln.dates)
      ) {
        return NextResponse.json(
          { ok: false, error: `Zeile ${i + 1}: ungültige Daten.` },
          { status: 400 },
        );
      }
    }

    const canonical = normalizeApproveCanonical({
      invoiceNumber,
      invoiceDate: invoiceDateRaw,
      projectTitle,
      includeKwDateBlock,
      lines,
    });
    const expectedHash = sha256CanonicalJson(canonical);
    const secret = getApprovalSecret();
    const verified = verifyApprovalToken(approvalToken, secret);
    if (!verified || verified.payloadHash !== expectedHash) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Ungültige oder abgelaufene Freigabe. Bitte Positionen erneut freigeben.",
        },
        { status: 403 },
      );
    }

    let positions;
    try {
      positions = draftLinesToInvoicePositions(
        canonical.lines,
        canonical.includeKwDateBlock,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Validierungsfehler";
      return NextResponse.json({ ok: false, error: msg }, { status: 422 });
    }

    const invoiceDate = dateFromYmd(canonical.invoiceDate);

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
