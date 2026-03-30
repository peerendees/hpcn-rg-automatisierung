"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InvoicePosition, OutputFormat } from "@/types/invoice";
import { CsvUploader, type ParsedRow } from "@/components/CsvUploader";
import { InvoicePreview } from "@/components/InvoicePreview";
import { OutputToggle } from "@/components/OutputToggle";

const STORAGE_KEY = "hpcn-rg-last-invoice-number";

function suggestNextInvoiceNumber(previous: string | null): string {
  if (!previous) return "";
  const digits = previous.match(/\d+/g);
  if (!digits) return previous;
  const last = digits[digits.length - 1]!;
  const n = parseInt(last, 10);
  if (Number.isNaN(n)) return previous;
  const next = String(n + 1);
  return previous.slice(0, previous.lastIndexOf(last)) + next;
}

export function InvoiceForm() {
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [files, setFiles] = useState<File[]>([]);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("docx");
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const prev = localStorage.getItem(STORAGE_KEY);
      const suggestion = suggestNextInvoiceNumber(prev);
      if (suggestion) setInvoiceNumber(suggestion);
    } catch {
      /* ignore */
    }
  }, []);

  const fileKey = useMemo(
    () => files.map((f) => `${f.name}:${f.size}`).join("|"),
    [files],
  );

  const filesRef = useRef(files);
  filesRef.current = files;

  useEffect(() => {
    const list = filesRef.current;
    if (list.length === 0) {
      setParsed([]);
      setParseError(null);
      return;
    }

    const ac = new AbortController();
    setParsing(true);
    setParseError(null);

    const fd = new FormData();
    list.forEach((f) => fd.append("csv", f));

    fetch("/api/parse-csv", { method: "POST", body: fd, signal: ac.signal })
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) throw new Error(data.error ?? "Parse fehlgeschlagen");
        setParsed(data.results as ParsedRow[]);
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        setParseError(e.message);
        setParsed([]);
      })
      .finally(() => setParsing(false));

    return () => ac.abort();
  }, [fileKey]);

  const positions: InvoicePosition[] = useMemo(
    () => parsed.map((r) => r.position),
    [parsed],
  );

  const handleGenerate = useCallback(async () => {
    setGenError(null);
    if (!invoiceNumber.trim() || !projectTitle.trim()) {
      setGenError("Rechnungsnummer und Projekttitel ausfüllen.");
      return;
    }
    if (files.length === 0 || positions.length === 0) {
      setGenError("Mindestens eine gültige CSV-Datei.");
      return;
    }

    setGenerating(true);
    try {
      const fd = new FormData();
      fd.set("invoiceNumber", invoiceNumber.trim());
      const [y, mo, d] = invoiceDate.split("-").map(Number);
      fd.set("date", new Date(y, mo - 1, d, 12, 0, 0).toISOString());
      fd.set("projectTitle", projectTitle.trim());
      fd.set("outputFormat", outputFormat);
      files.forEach((f) => fd.append("csv", f));

      const res = await fetch("/api/generate", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const dispo = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(dispo);
      const filename = match?.[1] ?? "download";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      try {
        localStorage.setItem(STORAGE_KEY, invoiceNumber.trim());
      } catch {
        /* ignore */
      }
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Export fehlgeschlagen");
    } finally {
      setGenerating(false);
    }
  }, [
    files,
    invoiceDate,
    invoiceNumber,
    outputFormat,
    positions.length,
    projectTitle,
  ]);

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/80 p-6 shadow-lg shadow-black/20 backdrop-blur-sm">
        <h2 className="font-[family-name:var(--font-display)] text-xl tracking-[0.08em] text-[var(--gold)]">
          RECHNUNGSDATEN
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-[var(--muted)]">
              Rechnungsnummer
            </span>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono text-sm text-[var(--text)] outline-none ring-[var(--copper)]/30 focus:border-[var(--copper)] focus:ring-2"
              placeholder="z. B. 608841"
              autoComplete="off"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-[var(--muted)]">
              Rechnungsdatum
            </span>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono text-sm text-[var(--text)] outline-none focus:border-[var(--copper)] focus:ring-2 focus:ring-[var(--copper)]/30"
            />
          </label>
        </div>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-[var(--muted)]">
            Projekttitel
          </span>
          <input
            type="text"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--copper)] focus:ring-2 focus:ring-[var(--copper)]/30"
            placeholder="z. B. Begleitung Kunde XY"
          />
        </label>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/80 p-6 shadow-lg shadow-black/20 backdrop-blur-sm">
        <h2 className="font-[family-name:var(--font-display)] text-xl tracking-[0.08em] text-[var(--gold)]">
          ZEITNACHWEISE
        </h2>
        <div className="mt-4">
          <CsvUploader
            files={files}
            onFilesChange={setFiles}
            parsed={parsed}
            parsing={parsing}
            parseError={parseError}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/80 p-6 shadow-lg shadow-black/20 backdrop-blur-sm">
        <h2 className="font-[family-name:var(--font-display)] text-xl tracking-[0.08em] text-[var(--gold)]">
          VORSCHAU
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Summen und Positionen nach erfolgreichem CSV-Import.
        </p>
        <div className="mt-4">
          <InvoicePreview positions={positions} />
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/80 p-6 shadow-lg shadow-black/20 backdrop-blur-sm">
        <h2 className="font-[family-name:var(--font-display)] text-xl tracking-[0.08em] text-[var(--gold)]">
          AUSGABE
        </h2>
        <div className="mt-4">
          <OutputToggle value={outputFormat} onChange={setOutputFormat} />
        </div>
        {genError && (
          <p className="mt-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-2 text-sm text-red-200">
            {genError}
          </p>
        )}
        <button
          type="button"
          disabled={
            generating ||
            parsing ||
            positions.length === 0 ||
            !invoiceNumber.trim() ||
            !projectTitle.trim()
          }
          onClick={handleGenerate}
          className="mt-6 w-full rounded-lg border border-[var(--copper)] bg-[var(--copper)]/90 py-3 font-[family-name:var(--font-display)] text-lg tracking-wider text-[#1a1108] transition hover:bg-[var(--copper)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {generating ? "Wird erzeugt …" : "Rechnung erzeugen & herunterladen"}
        </button>
      </section>
    </div>
  );
}
