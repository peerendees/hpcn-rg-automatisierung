/**
 * Feste Kundendaten und Fließtexte (Orientierung: Vorlage HPCN-Rechnung).
 * Anpassungen nur hier, nicht verstreut im Builder.
 */
export const invoiceTemplate = {
  issuer: {
    name: "Heinrich Professional Consultant Network GmbH",
    addressLines: ["Egeriaplatz 3", "72074 Tübingen"] as const,
  },
  customer: {
    name: "Göhrum Fahrzeugteile GmbH",
    street: "Ulmenstraße 19",
    zipCity: "71069 Sindelfingen",
    vatIdLabel: "Ihre Ust-ID:",
    vatId: "DE145144224",
    customerNoLabel: "Kd.-Nr.:",
    customerNo: "10602",
  },
  contact: {
    label: "Bei Rückfragen:",
    person: "Herr Wolfgang Heinrich",
    telLabel: "Tel.:",
    tel: "0049 7071 13 5 66-24",
    mailLabel: "Mail:",
    mail: "heinrich@h-pcn.de",
  },
  introParagraph:
    "Für die unten aufgeführten und in Auftrag gegebenen Lieferungen und Leistungen erlauben wir uns, Ihnen folgendes zu berechnen:",
  /** Projektname wird im Builder angehängt */
  serviceLinePrefix: "Dienstleistungen gemäß Projekt:",
  vatRatePercent: 19,
  leLabel: "Std.",
  /** Prototyp: Rechnungs-Stundensatz (CSV-Spalte rate wird ignoriert, Briefing-Fallback 70 €) */
  prototypeHourlyRate: 70,
} as const;
