"use client";

import type { ParsedCsvPositionRow } from "@/types/invoice";

export type ParsedFileResult = {
  fileName: string;
  rows: ParsedCsvPositionRow[];
};

type Props = {
  files: File[];
  onFilesChange: (files: File[]) => void;
  parsed: ParsedFileResult[];
  parsing: boolean;
  parseError: string | null;
  maxFiles?: number;
};

export function CsvUploader({
  files,
  onFilesChange,
  parsed,
  parsing,
  parseError,
  maxFiles = 4,
}: Props) {
  return (
    <div className="space-y-4">
      <div
        className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)]/40 px-6 py-10 text-center transition-colors hover:border-[var(--copper)]/50"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const next = [...files, ...Array.from(e.dataTransfer.files)].slice(
            0,
            maxFiles,
          );
          onFilesChange(next);
        }}
      >
        <p className="font-[family-name:var(--font-display)] text-lg tracking-wide text-[var(--gold)]">
          CSV-Dateien
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Bis zu {maxFiles} Dateien · Spalten: Datum, Kunde, Tätigkeit, Von, Bis ·
          Summenzeile optional · Delimiter automatisch
        </p>
        <label className="mt-6 inline-flex cursor-pointer items-center justify-center rounded-lg border border-[var(--copper)] bg-[var(--copper)]/10 px-5 py-2.5 text-sm font-medium text-[var(--gold)] transition hover:bg-[var(--copper)]/25">
          Dateien wählen
          <input
            type="file"
            accept=".csv,text/csv"
            multiple
            className="sr-only"
            onChange={(e) => {
              const list = e.target.files
                ? Array.from(e.target.files).slice(0, maxFiles)
                : [];
              onFilesChange(list);
            }}
          />
        </label>
      </div>

      {parseError && (
        <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-2 text-sm text-red-200">
          {parseError}
        </p>
      )}

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f, i) => {
            const row =
              parsed[i]?.fileName === f.name
                ? parsed[i]
                : parsed.find((r) => r.fileName === f.name);
            const count = row?.rows?.length ?? 0;
            const kwFirst = row?.rows?.[0]?.kw;
            return (
              <li
                key={`${f.name}-${i}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)]/60 px-4 py-3 text-sm"
              >
                <span className="truncate font-mono text-[var(--text)]">
                  {f.name}
                </span>
                {parsing && (
                  <span className="text-xs text-[var(--muted)]">…</span>
                )}
                {!parsing && row && count > 0 && (
                  <span className="rounded bg-[var(--copper)]/20 px-2 py-0.5 font-mono text-xs text-[var(--gold)]">
                    {count} Pos.
                    {kwFirst != null ? ` · KW${kwFirst}` : ""}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
