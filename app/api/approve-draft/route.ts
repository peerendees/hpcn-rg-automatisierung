import { NextResponse } from "next/server";
import { formatDeDecimal } from "@/lib/format-de";
import {
  computeTotals,
  draftLinesToInvoicePositions,
  normalizeApproveCanonical,
} from "@/lib/invoice-draft";
import { sha256CanonicalJson } from "@/lib/canonical-hash";
import {
  getApprovalSecret,
  signApprovalToken,
} from "@/lib/approval-token";
import type { DraftInvoiceLineWire } from "@/types/invoice";

export const runtime = "nodejs";

const TTL_SEC = 45 * 60;

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

type Body = {
  invoiceNumber?: string;
  invoiceDate?: string;
  projectTitle?: string;
  includeKwDateBlock?: boolean;
  lines?: DraftInvoiceLineWire[];
};

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

    const payloadHash = sha256CanonicalJson(canonical);
    const approvalToken = signApprovalToken(
      payloadHash,
      getApprovalSecret(),
      TTL_SEC,
    );
    const totals = computeTotals(positions);

    return NextResponse.json({
      ok: true,
      approvalToken,
      expiresInSeconds: TTL_SEC,
      totals: {
        net: formatDeDecimal(totals.net, 2),
        vat: formatDeDecimal(totals.vat, 2),
        gross: formatDeDecimal(totals.gross, 2),
      },
    });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Freigabe konnte nicht erstellt werden.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
