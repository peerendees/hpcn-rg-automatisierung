"use client";

import type { OutputFormat } from "@/types/invoice";

type Props = {
  value: OutputFormat;
  onChange: (v: OutputFormat) => void;
};

const OPTIONS: { id: OutputFormat; label: string }[] = [
  { id: "docx", label: "DOCX" },
  { id: "pdf", label: "PDF" },
  { id: "both", label: "Beides (ZIP)" },
];

export function OutputToggle({ value, onChange }: Props) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="radiogroup"
      aria-label="Ausgabeformat"
    >
      {OPTIONS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          className={
            value === id
              ? "rounded-lg border border-[var(--copper)] bg-[var(--copper)]/20 px-4 py-2 font-mono text-xs uppercase tracking-wide text-[var(--gold)]"
              : "rounded-lg border border-[var(--border)] bg-transparent px-4 py-2 font-mono text-xs uppercase tracking-wide text-[var(--muted)] transition hover:border-[var(--copper)]/40 hover:text-[var(--text)]"
          }
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
