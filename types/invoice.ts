/** Eine Rechnungsposition pro hochgeladener CSV-Datei */
export type InvoicePosition = {
  kw: number;
  year: number;
  totalHours: number;
  dates: string[];
  rate: number;
  positionText: string;
};

export type OutputFormat = "docx" | "pdf" | "both";
