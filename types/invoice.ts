/** Aus CSV-Zeile importierte Rohdaten (vor Bearbeitung in der UI). */
export type ParsedCsvPositionRow = {
  importedHours: number;
  activityLabel: string;
  kw: number;
  year: number;
  dates: string[];
};

/** Wire-Format für Freigabe/Generate (ohne React-Schlüssel). */
export type DraftInvoiceLineWire = {
  importedHours: number;
  /** Leer oder null → importedHours */
  overrideHoursText: string | null;
  activityLabel: string;
  rate: number;
  rateUserOverride: boolean;
  kw: number;
  year: number;
  dates: string[];
};

export type InvoiceApproveCanonical = {
  invoiceNumber: string;
  invoiceDate: string;
  projectTitle: string;
  includeKwDateBlock: boolean;
  lines: DraftInvoiceLineWire[];
};

/** Für DOCX/PDF */
export type InvoicePosition = {
  kw: number;
  year: number;
  totalHours: number;
  dates: string[];
  rate: number;
  positionText: string;
};

export type OutputFormat = "docx" | "pdf" | "both";
