/** Tausenderpunkt, Komma als Dezimalzeichen (DE) */
export function formatDeDecimal(value: number, fractionDigits = 2): string {
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatDeCurrency(value: number): string {
  return `${formatDeDecimal(value, 2)} €`;
}

export function formatDeHours(value: number): string {
  return `${formatDeDecimal(value, 1)} Std.`;
}
