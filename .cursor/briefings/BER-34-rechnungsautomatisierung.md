# Cursor-Briefing: Rechnungsautomatisierung Web App
**Datum:** 2026-03-30
**Linear-Issue:** [BER-34](https://linear.app/berent/issue/BER-34/rechnungsautomatisierung-web-app-fur-hpcn-prototyp)
**Projekt:** hpcn — Rechnungsautomatisierung
**URL:** rgform.berent.ai
**Komplexität:** Komplex

---

## Ziel

Eine Web App bauen, die CSV-Exporte aus einem Zeiterfassungssystem einliest, die Gesamtstunden pro Datei ermittelt und daraus eine fertige Rechnung als .docx und/oder PDF generiert. Pro CSV entsteht genau eine Positionszeile in der Rechnung. Prototyp für den Kunden hpcn, später skalierbar. Deployment als `rgform.berent.ai` im BERENT CI.

---

## Kontext

### Ausgangsdaten (CSV-Format)

Semikolon-separiert, Header:
```
type;category;project;task;subtask;unix_start;unix_end;start;end;date;start_time;end_time;duration;distance;quantity;rate;sum;rounding_minutes;rounding_method;billing;note;user
```

**Relevante Spalten pro CSV:**
- `duration` — `HH:MM:SS` oder Dezimal, alle Zeilen summieren
- `date` — Einzeldaten für Positionstext, KW daraus berechnen
- `rate` — Stundensatz (Fallback: 70)

**Ergebnis pro CSV (= eine Positionszeile):**
```typescript
{
  kw: number,
  year: number,
  totalHours: number,   // summierte Stunden aller Zeilen
  dates: string[],      // deduplizierte Einzeldaten, sortiert
  rate: number
}
```

**Positionstext-Format (Vorlage):**
```
KW47: 17., 18., 19., 21.11.: = 32,0 Std.
```
Monatszahl nur beim letzten Datum des jeweiligen Monats in der Liste.

### Zieldokument (Word-Struktur)

- Fester Kundenkopf aus `lib/invoice-template.ts`
- Rechnungsnummer, Datum, Projekttitel aus Formular
- Dynamische Positionstabelle: 1 Zeile pro CSV
  - Pos | Anzahl Std. | LE | Spezifikation | EP € | GP € netto
  - Spezifikation: `Lieferungs- und Leistungsdatum: KW{N}` + Datumstext + Stunden
- Zwischensumme netto, 19% MwSt., Bruttobetrag
- Zahlungsziel: Rechnungsdatum + 10 Tage

### BERENT CI

**Farben:**
```css
:root {
  --bg:     #090806;
  --card:   #110e0a;
  --border: #2a2118;
  --copper: #B5742A;
  --gold:   #E8C98A;
  --text:   #C4BCB1;
  --muted:  #7A6A58;
}
```

**Fonts (lokal hosten, kein Google CDN):**
- Headlines: Bebas Neue — UPPERCASE, letter-spacing 0.04–0.1em
- Body: Lora 300/400/600 — kein italic
- Code/Labels: JetBrains Mono

**Plus-Symbol** (CSS, Gold `#E8C98A`):
```css
.plus-mark { width: 18px; height: 18px; position: relative; flex-shrink: 0; }
.plus-mark::before, .plus-mark::after {
  content: ''; position: absolute; background: var(--gold); border-radius: 1px;
}
.plus-mark::before { width: 2px; height: 100%; left: 50%; top: 0; transform: translateX(-50%); }
.plus-mark::after  { width: 100%; height: 2px; top: 50%; left: 0; transform: translateY(-50%); }
```

**Pflicht-Footer:**
```html
<footer>
  <div class="plus-mark"></div> BERENT
  <span>RG-Form · berent.ai</span>
  <div>
    <a href="https://berent.ai/impressum.html">Impressum</a>
    <a href="https://berent.ai">← Zurück zur Hauptseite</a>
  </div>
</footer>
```

CI-Datei für Cursor: `.cursor/rules/berent-ci.md` anlegen.

---

## Entschiedene Parameter

| Parameter | Wert |
|---|---|
| Rechnungsnummer | Auto-Vorschlag via `localStorage` (letzte + 1), manuell überschreibbar |
| Datum | Default heute, überschreibbar per Datepicker |
| CSVs | 1–4 Dateien, je eine Positionszeile |
| CSV-Parser | Gesamtstunden summieren + KW/Datumsinfos für Positionstext |
| Template | Kundendaten fest in `lib/invoice-template.ts`, Tabelle dynamisch |
| Ausgabe | Toggle: `.docx` / PDF / beides |

---

## Dateistruktur

```
hpcn-rg-automatisierung/
├── app/
│   ├── page.tsx
│   ├── layout.tsx
│   └── api/
│       ├── generate/route.ts       # POST: CSV → Rechnung generieren
│       └── parse-csv/route.ts      # POST: CSV validieren + parsen
├── components/
│   ├── InvoiceForm.tsx
│   ├── CsvUploader.tsx             # Drag & Drop, max. 4 Dateien
│   ├── InvoicePreview.tsx          # Vorschau-Tabelle vor Export
│   └── OutputToggle.tsx            # docx / PDF / beides
├── lib/
│   ├── csv-parser.ts               # CSV → InvoicePosition
│   ├── invoice-builder.ts          # docx aufbauen
│   ├── pdf-converter.ts            # docx → PDF
│   └── invoice-template.ts         # Feste Kundendaten hpcn
├── types/
│   └── invoice.ts
├── assets/fonts/                   # Bebas Neue, Lora, JetBrains Mono .woff2
└── .cursor/rules/berent-ci.md      # CI-Regeln für Cursor
```

---

## Kernlogik

### CSV-Parser (`lib/csv-parser.ts`)

```typescript
export function parseCsv(content: string): InvoicePosition {
  // 1. Semikolon-Trenner, Header-Zeile auslesen
  // 2. duration summieren:
  //    "HH:MM:SS" → Stunden + Minuten/60 + Sekunden/3600
  //    Dezimalzahl → direkt
  // 3. date-Spalte: deduplicieren, sortieren
  // 4. KW aus Datumseinträgen (ISO 8601)
  // 5. rate: ersten Wert nehmen, Fallback 70
  // 6. Positionstext aufbauen (siehe unten)
  return { kw, year, totalHours, dates, rate, positionText }
}
```

### Positionstext-Logik

```typescript
function buildPositionText(kw: number, dates: Date[], totalHours: number): string {
  // "KW47: 17., 18., 19., 21.11.: = 32,0 Std."
  // Monatszahl nur beim letzten Datum des jeweiligen Monats
  const dayStrings = dates.map((d, i) => {
    const isLastOfMonth = i === dates.length - 1 ||
      dates[i + 1].getMonth() !== d.getMonth()
    return isLastOfMonth
      ? `${d.getDate()}.${d.getMonth() + 1}.`
      : `${d.getDate()}.`
  })
  const hoursFormatted = totalHours.toFixed(1).replace('.', ',')
  return `KW${kw}: ${dayStrings.join(', ')}: = ${hoursFormatted} Std.`
}
```

### Invoice Builder (`lib/invoice-builder.ts`)

```typescript
// docx-npm-Paket
// 1. Kundenkopf aus invoice-template.ts
// 2. Rechnungsnummer, Datum, Projekt aus Formular
// 3. Positionstabelle dynamisch: für jede InvoicePosition eine Zeile
//    Spezifikation = "Lieferungs- und Leistungsdatum: {positionText}"
// 4. Zwischensumme = Summe aller GP
// 5. MwSt = Zwischensumme × 0.19
// 6. Brutto = Zwischensumme + MwSt
// 7. Zahlungsziel = Datum + 10 Tage
// Zahlenformat: Tausenderpunkt, Komma als Dezimalzeichen
```

### API-Route `/api/generate` (POST)

```typescript
// Input: FormData
//   csvFiles: File[]          (1–4)
//   invoiceNumber: string
//   date: string              (ISO)
//   projectTitle: string
//   outputFormat: 'docx' | 'pdf' | 'both'
//
// Output:
//   'docx'  → .docx Download
//   'pdf'   → .pdf Download
//   'both'  → .zip mit beiden
```

---

## UI-Formular

Felder im BERENT CI (Hintergrund `#090806`, Kupfer-Akzente `#B5742A`):
- Rechnungsnummer — text input, localStorage-Vorschlag
- Datum — date input, default heute
- Projekttitel — text input
- CSV-Upload — Drag & Drop, max. 4 Dateien, KW-Label nach Parse
- Ausgabeformat — 3-Option-Toggle
- Vorschau-Button → InvoicePreview
- Generieren-Button (Kupfer) → Download

Nach Download: Rechnungsnummer in localStorage speichern.

---

## Deployment: rgform.berent.ai

```bash
# Vercel verknüpfen
vercel link --scope peerendees-projects

# Nach erstem Deploy:
# Vercel Dashboard → Project → Settings → Domains → rgform.berent.ai
```

**Cloudflare DNS (manuell):**

| Feld | Wert |
|------|------|
| Type | CNAME |
| Name | rgform |
| Target | cname.vercel-dns.com |
| Proxy | DNS only (graue Wolke) |

---

## Akzeptanzkriterien

- [ ] CSV semikolon-separiert korrekt geparst
- [ ] Stunden summiert (HH:MM:SS und Dezimal)
- [ ] Positionstext entspricht Vorlage-Format
- [ ] 1–4 CSVs → 1–4 Tabellenzeilen
- [ ] Zwischensumme, MwSt. 19%, Brutto korrekt
- [ ] Zahlungsziel = Datum + 10 Tage
- [ ] docx valide, in Word öffenbar
- [ ] PDF-Export funktioniert
- [ ] localStorage-Persistenz für Rechnungsnummer
- [ ] Vorschau korrekt
- [ ] BERENT CI vollständig (Farben, Fonts, Footer, Plus)
- [ ] Erreichbar unter rgform.berent.ai

---

## Setup-Schritte

```bash
# 1. Projekt anlegen
npx create-next-app@latest hpcn-rg-automatisierung \
  --typescript --tailwind --app --no-src-dir --import-alias '@/*'

cd hpcn-rg-automatisierung

# 2. Abhängigkeiten
npm install docx papaparse
npm install -D @types/papaparse
npm install @sparticuz/chromium puppeteer-core

# 3. Fonts lokal
mkdir -p assets/fonts
# → Bebas Neue, Lora (300/400/600), JetBrains Mono (300/400/700) als .woff2

# 4. CI-Regeln für Cursor
mkdir -p .cursor/rules
# → berent-ci.md mit Farbpalette, Fonts, Footer-Pflichtstruktur

# 5. Repo + Vercel
git init
git remote add origin https://github.com/peerendees/hpcn-rg-automatisierung.git
git push -u origin main
vercel link --scope peerendees-projects
```

---

## Abschluss

Wenn alle Änderungen umgesetzt sind:

```bash
git add -A
git commit -m "[BER-34] done: Rechnungsautomatisierung Web App Prototyp"
git push
```

Triggert: Linear → Done · Threema-Benachrichtigung · Notion-Marker.
