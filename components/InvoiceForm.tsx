"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OutputFormat } from "@/types/invoice";
import { invoiceTemplate } from "@/lib/invoice-template";
import {
  CsvUploader,
  type ParsedFileResult,
} from "@/components/CsvUploader";
import {
  InvoiceDraftTable,
  linesToWire,
  type ClientDraftLine,
} from "@/components/InvoiceDraftTable";
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

function newLineId(fi: number, ri: number): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `l-${fi}-${ri}-${Date.now()}`;
}

export function InvoiceForm() {
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [files, setFiles] = useState<File[]>([]);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("docx");
  const [parsedFiles, setParsedFiles] = useState<ParsedFileResult[]>([]);
  const [lines, setLines] = useState<ClientDraftLine[]>([]);
  const [globalRate, setGlobalRate] = useState<number>(
    () => invoiceTemplate.prototypeHourlyRate,
  );
  const [includeKwDateBlock, setIncludeKwDateBlock] = useState(false);
  const [approvalToken, setApprovalToken] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const globalRateRef = useRef(globalRate);
  globalRateRef.current = globalRate;

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
      setParsedFiles([]);
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
        setParsedFiles(data.results as ParsedFileResult[]);
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        setParseError(e.message);
        setParsedFiles([]);
      })
      .finally(() => setParsing(false));

    return () => ac.abort();
  }, [fileKey]);

  useEffect(() => {
    if (parsedFiles.length === 0) {
      setLines([]);
      return;
    }
    const rate = globalRateRef.current;
    const seeded = parsedFiles.flatMap((f, fi) =>
      f.rows.map((r, ri) => ({
        id: newLineId(fi, ri),
        importedHours: r.importedHours,
        overrideHoursText: "",
        activityLabel: r.activityLabel,
        rate,
        rateUserOverride: false,
        kw: r.kw,
        year: r.year,
        dates: [...r.dates],
      })),
    );
    setLines(seeded);
  }, [fileKey, parsedFiles]);

  useEffect(() => {
    setApprovalToken(null);
    setApproveError(null);
  }, [lines, includeKwDateBlock, invoiceNumber, projectTitle, invoiceDate]);

  const handleGlobalRateChange = useCallback((next: number) => {
    setGlobalRate(next);
    setLines((prev) =>
      prev.map((l) =>
        l.rateUserOverride ? l : { ...l, rate: next },
      ),
    );
  }, []);

  const handleApprove = useCallback(async () => {
    setApproveError(null);
    if (!invoiceNumber.trim() || !projectTitle.trim()) {
      setApproveError("Rechnungsnummer und Projekttitel ausfüllen.");
      return;
    }
    if (lines.length === 0) {
      setApproveError("Keine Positionen zum Freigeben.");
      return;
    }

    setApproving(true);
    try {
      const body = {
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        projectTitle: projectTitle.trim(),
        includeKwDateBlock,
        lines: linesToWire(lines),
      };
      const res = await fetch("/api/approve-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setApprovalToken(String(data.approvalToken));
    } catch (e) {
      setApprovalToken(null);
      setApproveError(
        e instanceof Error ? e.message : "Freigabe fehlgeschlagen",
      );
    } finally {
      setApproving(false);
    }
  }, [
    invoiceNumber,
    invoiceDate,
    projectTitle,
    includeKwDateBlock,
    lines,
  ]);

  const handleGenerate = useCallback(async () => {
    setGenError(null);
    if (!invoiceNumber.trim() || !projectTitle.trim()) {
      setGenError("Rechnungsnummer und Projekttitel ausfüllen.");
      return;
    }
    if (lines.length === 0) {
      setGenError("Keine Positionen.");
      return;
    }
    if (!approvalToken) {
      setGenError("Bitte zuerst Positionen freigeben.");
      return;
    }

    setGenerating(true);
    try {
      const body = {
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        projectTitle: projectTitle.trim(),
        includeKwDateBlock,
        lines: linesToWire(lines),
        outputFormat,
        approvalToken,
      };
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
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
    invoiceNumber,
    invoiceDate,
    projectTitle,
    includeKwDateBlock,
    lines,
    outputFormat,
    approvalToken,
  ]);

  const draftDisabled = parsing || files.length === 0;

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
            parsed={parsedFiles}
            parsing={parsing}
            parseError={parseError}
          />
        </div>
      </section>

      {lines.length > 0 && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/80 p-6 shadow-lg shadow-black/20 backdrop-blur-sm">
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-[0.08em] text-[var(--gold)]">
            POSITIONEN BEARBEITEN
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Importierte Stunden, optional überschreiben; Tätigkeit editieren.
            Freigabe bindet den Datenstand serverseitig für den Export.
          </p>
          <div className="mt-4">
            <InvoiceDraftTable
              lines={lines}
              onLinesChange={setLines}
              globalRate={globalRate}
              onGlobalRateChange={handleGlobalRateChange}
              includeKwDateBlock={includeKwDateBlock}
              onIncludeKwDateBlockChange={setIncludeKwDateBlock}
              disabled={draftDisabled}
            />
          </div>

          {approveError && (
            <p className="mt-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-2 text-sm text-red-200">
              {approveError}
            </p>
          )}

          <button
            type="button"
            disabled={
              approving ||
              parsing ||
              lines.length === 0 ||
              !invoiceNumber.trim() ||
              !projectTitle.trim()
            }
            onClick={() => void handleApprove()}
            className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 font-[family-name:var(--font-display)] text-sm tracking-wider text-[var(--gold)] transition hover:border-[var(--copper)] hover:bg-[var(--copper)]/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {approving ? "Freigabe wird erstellt …" : "Positionen freigeben"}
          </button>

          {approvalToken && (
            <p className="mt-3 text-xs font-mono text-[var(--muted)]">
              Freigabe aktiv — Änderungen an Positionen setzen die Freigabe
              zurück.
            </p>
          )}
        </section>
      )}

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
            lines.length === 0 ||
            !invoiceNumber.trim() ||
            !projectTitle.trim() ||
            !approvalToken
          }
          onClick={() => void handleGenerate()}
          className="mt-6 w-full rounded-lg border border-[var(--copper)] bg-[var(--copper)]/90 py-3 font-[family-name:var(--font-display)] text-lg tracking-wider text-[#1a1108] transition hover:bg-[var(--copper)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {generating ? "Wird erzeugt …" : "Rechnung erzeugen und herunterladen"}
        </button>
      </section>
    </div>
  );
}
