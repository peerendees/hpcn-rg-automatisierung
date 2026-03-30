import type { InvoicePosition } from "@/types/invoice";
import { formatDeCurrency, formatDeDecimal } from "@/lib/format-de";
import { invoiceTemplate } from "@/lib/invoice-template";

type Props = {
  positions: InvoicePosition[];
};

function totals(positions: InvoicePosition[]) {
  const net = positions.reduce((s, p) => s + p.totalHours * p.rate, 0);
  const vat = net * (invoiceTemplate.vatRatePercent / 100);
  return { net, vat, gross: net + vat };
}

export function InvoicePreview({ positions }: Props) {
  if (positions.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Noch keine gültigen CSV-Positionen — Dateien hochladen.
      </p>
    );
  }
  const { net, vat, gross } = totals(positions);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm text-[var(--text)]">
        <thead>
          <tr className="border-b border-[var(--border)] text-[var(--gold)]">
            <th className="p-2 font-mono text-xs font-normal uppercase tracking-wide">
              Pos
            </th>
            <th className="p-2 font-mono text-xs font-normal uppercase tracking-wide">
              Std.
            </th>
            <th className="p-2 font-mono text-xs font-normal uppercase tracking-wide">
              EP
            </th>
            <th className="p-2 font-mono text-xs font-normal uppercase tracking-wide">
              GP netto
            </th>
            <th className="p-2 font-mono text-xs font-normal uppercase tracking-wide">
              Spezifikation
            </th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p, i) => (
            <tr
              key={i}
              className="border-b border-[var(--border)]/70 hover:bg-[var(--card)]/50"
            >
              <td className="p-2 align-top font-mono text-xs">
                {String(i + 1).padStart(2, "0")}
              </td>
              <td className="p-2 align-top tabular-nums">
                {formatDeDecimal(p.totalHours, 1)}
              </td>
              <td className="p-2 align-top tabular-nums">
                {formatDeCurrency(p.rate)}
              </td>
              <td className="p-2 align-top tabular-nums">
                {formatDeCurrency(p.totalHours * p.rate)}
              </td>
              <td className="p-2 align-top font-mono text-xs leading-relaxed text-[var(--muted)]">
                {p.positionText}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 space-y-1 border-t border-[var(--border)] pt-4 text-sm tabular-nums">
        <div className="flex justify-between text-[var(--text)]">
          <span>Zwischensumme netto</span>
          <span>{formatDeCurrency(net)}</span>
        </div>
        <div className="flex justify-between text-[var(--muted)]">
          <span>{invoiceTemplate.vatRatePercent} % MwSt.</span>
          <span>{formatDeCurrency(vat)}</span>
        </div>
        <div className="flex justify-between text-[var(--gold)]">
          <span className="font-medium">Brutto</span>
          <span className="font-medium">{formatDeCurrency(gross)}</span>
        </div>
      </div>
    </div>
  );
}
