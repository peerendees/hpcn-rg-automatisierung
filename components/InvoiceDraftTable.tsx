"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type TextareaHTMLAttributes,
} from "react";
import type { DraftInvoiceLineWire, InvoicePosition } from "@/types/invoice";
import { invoiceTemplate } from "@/lib/invoice-template";
import {
  computeTotals,
  draftLinesToInvoicePositions,
  effectiveHoursFromWire,
} from "@/lib/invoice-draft";
import { formatDeCurrency, formatDeDecimal } from "@/lib/format-de";
import { parseDeDecimal } from "@/lib/parse-de-number";
import { deliveryDateLine } from "@/lib/invoice-spec";

/** Textfeld wächst mit dem Inhalt — Tätigkeitstexte bleiben ohne inneres Scrollen vollständig sichtbar. */
function AutoGrowTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.height = "auto";
      // scrollHeight ohne Rahmen; Differenz offset/client ergänzt ihn
      el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
    };
    fit();
    // Andere Breite (Fenster, Spalte) ändert den Umbruch — nur darauf reagieren, nicht auf die eigene Höhe
    let lastWidth = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === lastWidth) return;
      lastWidth = el.clientWidth;
      fit();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [props.value]);

  return <textarea ref={ref} {...props} />;
}

export type ClientDraftLine = Omit<DraftInvoiceLineWire, "overrideHoursText"> & {
  id: string;
  /** Roh-Eingabe Überschreib-Stunden (leer = Import) */
  overrideHoursText: string;
  /** Roh-Eingabe Stundensatz (wird erst bei Blur geparst/formatiert) */
  rateText: string;
};

type Props = {
  lines: ClientDraftLine[];
  onLinesChange: (next: ClientDraftLine[]) => void;
  globalRate: number;
  onGlobalRateChange: (rate: number) => void;
  includeKwDateBlock: boolean;
  onIncludeKwDateBlockChange: (v: boolean) => void;
  disabled?: boolean;
};

export function linesToWire(lines: ClientDraftLine[]): DraftInvoiceLineWire[] {
  return lines.map((l) => ({
    importedHours: l.importedHours,
    overrideHoursText:
      l.overrideHoursText.trim() === ""
        ? null
        : l.overrideHoursText.trim(),
    activityLabel: l.activityLabel,
    rate: l.rate,
    rateUserOverride: l.rateUserOverride,
    kw: l.kw,
    year: l.year,
    dates: [...l.dates],
  }));
}

/** Parst eine Satz-Eingabe; null bei ungültig/negativ. */
export function parseRateInput(raw: string): number | null {
  const n = parseDeDecimal(raw);
  if (n === null || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export function InvoiceDraftTable({
  lines,
  onLinesChange,
  globalRate,
  onGlobalRateChange,
  includeKwDateBlock,
  onIncludeKwDateBlockChange,
  disabled,
}: Props) {
  const [globalRateText, setGlobalRateText] = useState(() =>
    formatDeDecimal(globalRate, 2),
  );
  let positionsPreview: InvoicePosition[] = [];
  try {
    positionsPreview = draftLinesToInvoicePositions(
      linesToWire(lines),
      includeKwDateBlock,
    );
  } catch {
    positionsPreview = [];
  }

  const totals =
    positionsPreview.length > 0 ? computeTotals(positionsPreview) : null;

  function patchLine(index: number, patch: Partial<ClientDraftLine>) {
    onLinesChange(
      lines.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-6 rounded-lg border border-[var(--border)] bg-[var(--card)]/40 px-4 py-3 text-sm">
        <label className="flex cursor-pointer items-center gap-2 text-[var(--text)]">
          <input
            type="checkbox"
            checked={includeKwDateBlock}
            disabled={disabled}
            onChange={(e) => onIncludeKwDateBlockChange(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--border)] accent-[var(--copper)]"
          />
          <span>KW- und Datumsangabe zur Spezifikation hinzufügen</span>
        </label>
        <label className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-wide text-[var(--muted)]">
            Stundensatz alle Zeilen (€)
          </span>
          <input
            type="text"
            inputMode="decimal"
            disabled={disabled}
            value={globalRateText}
            onChange={(e) => setGlobalRateText(e.target.value)}
            onBlur={() => {
              const n = parseRateInput(globalRateText);
              if (n === null) {
                setGlobalRateText(formatDeDecimal(globalRate, 2));
                return;
              }
              setGlobalRateText(formatDeDecimal(n, 2));
              onGlobalRateChange(n);
            }}
            className="w-28 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 font-mono text-sm text-[var(--text)] outline-none focus:border-[var(--copper)] focus:ring-1 focus:ring-[var(--copper)]/40"
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full min-w-[960px] border-collapse text-left text-sm text-[var(--text)]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--card)]/60 text-[var(--gold)]">
              <th className="whitespace-nowrap p-2 font-mono text-xs font-normal uppercase tracking-wide">
                Pos
              </th>
              <th className="whitespace-nowrap p-2 font-mono text-xs font-normal uppercase tracking-wide">
                Std. import
              </th>
              <th className="whitespace-nowrap p-2 font-mono text-xs font-normal uppercase tracking-wide">
                Std. effektiv
              </th>
              <th className="whitespace-nowrap p-2 font-mono text-xs font-normal uppercase tracking-wide">
                LE
              </th>
              {/* w-full: Tätigkeit bekommt die Restbreite, Zahlenspalten bleiben inhaltsbreit */}
              <th className="w-full whitespace-nowrap p-2 font-mono text-xs font-normal uppercase tracking-wide">
                Spezifikation (Tätigkeit)
              </th>
              <th className="whitespace-nowrap p-2 font-mono text-xs font-normal uppercase tracking-wide">
                EP €
              </th>
              <th className="whitespace-nowrap p-2 font-mono text-xs font-normal uppercase tracking-wide">
                GP € nt.
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => {
              const wireLine = linesToWire(lines)[i]!;
              let effH = line.importedHours;
              try {
                effH = effectiveHoursFromWire(wireLine);
              } catch {
                effH = line.importedHours;
              }
              const gp = effH * line.rate;
              return (
                <tr
                  key={line.id}
                  className="border-b border-[var(--border)]/70 hover:bg-[var(--card)]/40"
                >
                  <td className="p-2 align-top font-mono text-xs">
                    {String(i + 1).padStart(2, "0")}
                  </td>
                  <td className="p-2 align-top tabular-nums text-[var(--muted)]">
                    {formatDeDecimal(line.importedHours, 1)}
                  </td>
                  <td className="p-2 align-top">
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={disabled}
                      placeholder={formatDeDecimal(line.importedHours, 1)}
                      value={line.overrideHoursText}
                      onChange={(e) =>
                        patchLine(i, { overrideHoursText: e.target.value })
                      }
                      className="w-24 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 font-mono text-xs tabular-nums text-[var(--text)] outline-none focus:border-[var(--copper)] focus:ring-1 focus:ring-[var(--copper)]/40"
                    />
                  </td>
                  <td className="p-2 align-top font-mono text-xs text-[var(--muted)]">
                    {invoiceTemplate.leLabel}
                  </td>
                  <td className="p-2 align-top">
                    {deliveryDateLine(line.dates) && (
                      <p className="mb-1 font-mono text-[11px] leading-snug text-[var(--muted)]">
                        {deliveryDateLine(line.dates)}
                      </p>
                    )}
                    <AutoGrowTextarea
                      disabled={disabled}
                      rows={2}
                      value={line.activityLabel}
                      onChange={(e) =>
                        patchLine(i, { activityLabel: e.target.value })
                      }
                      className="min-h-[2.5rem] w-full min-w-[220px] resize-none overflow-hidden rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs leading-snug text-[var(--text)] outline-none focus:border-[var(--copper)] focus:ring-1 focus:ring-[var(--copper)]/40"
                    />
                  </td>
                  <td className="p-2 align-top">
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={disabled}
                      value={line.rateText}
                      onChange={(e) =>
                        patchLine(i, { rateText: e.target.value })
                      }
                      onBlur={() => {
                        const n = parseRateInput(line.rateText);
                        if (n === null) {
                          patchLine(i, {
                            rateText: formatDeDecimal(line.rate, 2),
                          });
                          return;
                        }
                        patchLine(i, {
                          rate: n,
                          rateText: formatDeDecimal(n, 2),
                          rateUserOverride: true,
                        });
                      }}
                      className="w-24 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 font-mono text-xs tabular-nums outline-none focus:border-[var(--copper)] focus:ring-1 focus:ring-[var(--copper)]/40"
                    />
                  </td>
                  <td className="whitespace-nowrap p-2 align-top tabular-nums">
                    {formatDeCurrency(gp)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totals && (
        <div className="space-y-1 border-t border-[var(--border)] pt-4 text-sm tabular-nums">
          <div className="flex justify-between text-[var(--text)]">
            <span>Zwischensumme netto</span>
            <span>{formatDeCurrency(totals.net)}</span>
          </div>
          <div className="flex justify-between text-[var(--muted)]">
            <span>{invoiceTemplate.vatRatePercent} % MwSt.</span>
            <span>{formatDeCurrency(totals.vat)}</span>
          </div>
          <div className="flex justify-between text-[var(--gold)]">
            <span className="font-medium">Brutto</span>
            <span className="font-medium">{formatDeCurrency(totals.gross)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
