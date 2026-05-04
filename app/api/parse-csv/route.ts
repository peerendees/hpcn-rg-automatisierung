import { NextResponse } from "next/server";
import type { ParsedCsvPositionRow } from "@/types/invoice";
import { parseCsv } from "@/lib/csv-parser";

export const runtime = "nodejs";

/**
 * POST multipart: mehrere Felder `csv` — je eine CSV-Datei, max. 4.
 */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("csv") as File[];
    if (files.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Keine CSV-Datei übermittelt." },
        { status: 400 },
      );
    }
    if (files.length > 4) {
      return NextResponse.json(
        { ok: false, error: "Maximal 4 CSV-Dateien." },
        { status: 400 },
      );
    }

    const results: { fileName: string; rows: ParsedCsvPositionRow[] }[] = [];
    for (const file of files) {
      const text = await file.text();
      const rows = parseCsv(text);
      results.push({ fileName: file.name, rows });
    }

    return NextResponse.json({ ok: true, results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
    return NextResponse.json({ ok: false, error: msg }, { status: 422 });
  }
}
