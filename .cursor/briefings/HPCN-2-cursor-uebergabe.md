# Cursor-Übergabe: HPCN-2 — CSV-Parser Update & Planung
**Datum:** 2026-05-04
**Linear-Issue:** [HPCN-2](https://linear.app/berent/issue/HPCN-2/end-to-end-test-rgformberentai)
**Projekt:** hpcn-rg-automatisierung
**Repo:** `https://github.com/peerendees/hpcn-rg-automatisierung.git`
**Branch:** `main` | Letzter bekannter Commit: `53841c6`
**App:** [rgform.berent.ai](https://rgform.berent.ai)

---

## MCP-Verfügbarkeit in Cursor

| MCP | Status | Verwendung |
|-----|--------|------------|
| Linear | ✅ 30 Tools | Issues lesen, anlegen, kommentieren, Status setzen |
| Supabase | ✅ 29 Tools | Datenbankoperationen |
| Notion | ✅ Verbunden | Seiten lesen und aktualisieren |
| Cloudflare | ✅ Verbunden | DNS, Workers, Pages |
| GitHub | ❌ Disabled | → Git-Push via Terminal |
| n8n | ⚠️ Fehler | SSE-Stream Not Found — aktuell nicht nutzbar |
| Slack | ❌ Needs auth | → Nicht verbunden |

**Wichtig:** Linear, Notion und Cloudflare können direkt aus Cursor bedient werden.
n8n ist aktuell defekt (SSE-Fehler) — nicht verwenden.

---

## Aktueller Stand der App

Folgende Arbeitspakete sind bereits abgeschlossen und live:

- CSV-Parser (UTF-8 BOM, Auto-Delimiter, Minuten/Stunden-Erkennung)
- DOCX-Generierung (docxtemplater + pizzip auf Word-Vorlage)
- PDF-Konvertierung (Mammoth + Puppeteer/Chromium)
- API-Routes (`/api/parse-csv`, `/api/generate` mit FormData/ZIP)
- UI-Komponenten (InvoiceForm, CsvUploader, InvoicePreview, OutputToggle)
- Navigation + Theme (SiteNav, ThemeProvider, Dark/Light wie berent.ai)
- Favicon von berent.ai integriert
- DOCX-Korruptionsbug behoben (`w:tr` vs. `w:trPr` im Template-Build)
- Deployment auf `rgform.berent.ai` live

---

## Offene Aufgaben (Planungsmodus)

### 1. CSV-Format-Änderung — Parser anpassen

Das bisherige CSV-Format (semikolon-separiert, 22 Spalten) wird durch ein neues,
vereinfachtes Format abgelöst:

| Spalte | Beschreibung |
|--------|-------------|
| Datum | Leistungsdatum (einzelner Tag) |
| Kunde | Kundenbezeichnung |
| Tätigkeit | Beschreibung der erbrachten Leistung |
| Von | Startzeit (HH:MM) |
| Bis | Endzeit (HH:MM) |
| *(Summe)* | Am Ende der Tabelle: Gesamtstunden als Summenzelle |

**Offene Planungsfragen (im Planungsmodus klären):**

- Wird das alte Format noch unterstützt (Fallback), oder komplett abgelöst?
- Wie wird die Summe am Tabellenende zuverlässig erkannt?
- Stunden aus Von/Bis berechnen oder nur Summe am Ende lesen?
- Delimiter: Semikolon beibehalten, oder Komma/Tab?
- Wird Kunde für den Positionstext genutzt oder nur Tätigkeit?

### 2. End-to-End-Test

Sobald Parser angepasst:

1. rgform.berent.ai im Browser öffnen
2. Neue CSV-Testdatei hochladen (neues Format)
3. Rechnungsnummer, Datum, Projekttitel eintragen
4. Vorschau prüfen — Positionen, Stunden, Beträge korrekt?
5. DOCX generieren → in Word öffnen → Layout, Tabelle, Zahlungsziel prüfen
6. PDF generieren → Darstellung prüfen
7. ZIP (beides) testen

**Akzeptanzkriterien:**
- Stunden korrekt aus neuem Format summiert
- Positionstext entspricht Vorlage (KW, Tagesliste, Stunden)
- Zwischensumme, MwSt. 19%, Brutto korrekt
- Zahlungsziel = Rechnungsdatum + 10 Tage
- DOCX valide und in Word öffenbar
- PDF korrekt dargestellt
- ZIP enthält beide Dateien

---

## Wichtige Hinweise für Cursor

### BERENT CI
Die App läuft unter rgform.berent.ai im BERENT Corporate Design:
- Hintergrund: #090806
- Akzent / Kupfer: #B5742A
- Gold: #E8C98A
- Fonts: Bebas Neue (Headlines), Lora (Body), JetBrains Mono (Code)
- CI-Regeln: .cursor/rules/berent-ci.md im Repo

### Commit-Konvention
[HPCN-2] feat: CSV-Parser auf neues Format umgestellt
[HPCN-2] fix: Stunden-Berechnung aus Von/Bis
[HPCN-2] done: End-to-End-Test bestanden

---

## Rückkanal

### Linear → direkt aus Cursor via Linear-MCP
- Issue-Status setzen (HPCN-2 → In Progress / Done)
- Kommentare hinterlassen
- Neue Sub-Issues anlegen

### Notion → direkt aus Cursor via Notion-MCP
- Briefing-Seite aktualisieren (ID: 33331cc6-fd56-81fc-8a1a-fd29ab046089)
- PARA-Hub aktualisieren (ID: 33131cc6-fd56-8102-b0d7-d10557364753)

### n8n → aktuell nicht nutzbar
SSE-Verbindungsfehler: "Failed to open SSE stream: Not Found"
Nicht verwenden bis das Problem behoben ist.

### Claude → für übergreifende Koordination
Wenn mehrere Kanäle gleichzeitig aktualisiert werden müssen oder
etwas außerhalb des HPCN-Projekts koordiniert werden muss.

---

## Prompt für Cursor (Planungsmodus)

@HPCN-2-cursor-uebergabe.md

Lies die Übergabe vollständig. Wir befinden uns im Planungsmodus.

Aktueller Stand: Die App rgform.berent.ai ist live. Der CSV-Parser
verarbeitet aktuell ein 22-Spalten-Format (semikolon-separiert).

Geplante Änderung: Das CSV-Format wird vereinfacht auf 5 Spalten:
Datum | Kunde | Tätigkeit | Von | Bis — plus eine Summenzeile am Ende.

Du hast Linear, Notion und Cloudflare per MCP direkt verfügbar.
Nutze Linear und Notion direkt für Statusupdates.
n8n ist aktuell defekt — nicht verwenden.

Bitte kläre zunächst folgende Punkte mit mir, bevor du Code schreibst:

1. Altes Format beibehalten als Fallback, oder komplett ablösen?
2. Stunden aus Von/Bis berechnen oder nur Summenzeile lesen?
3. Wie soll die Summenzeile zuverlässig erkannt werden?
4. Wird der Kunde-Wert in den Positionstext übernommen?
5. Was ist der Delimiter im neuen Format?

Erst nach Klärung dieser Fragen: Implementierungsplan vorschlagen.
