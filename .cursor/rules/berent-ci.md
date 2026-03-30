# BERENT CI — RG-Form (hpcn Rechnungsautomatisierung)

Diese Regeln gelten für UI, Typografie und wiederkehrende Layout-Elemente.

## Farben

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

## Fonts (lokal hosten, kein Google CDN)

- **Headlines:** Bebas Neue — UPPERCASE, letter-spacing 0.04–0.1em
- **Body:** Lora 300/400/600 — kein italic
- **Code/Labels:** JetBrains Mono

Dateien unter `assets/fonts/` als `.woff2`.

## Plus-Symbol (Gold `#E8C98A`)

```css
.plus-mark { width: 18px; height: 18px; position: relative; flex-shrink: 0; }
.plus-mark::before, .plus-mark::after {
  content: ''; position: absolute; background: var(--gold); border-radius: 1px;
}
.plus-mark::before { width: 2px; height: 100%; left: 50%; top: 0; transform: translateX(-50%); }
.plus-mark::after  { width: 100%; height: 2px; top: 50%; left: 0; transform: translateY(-50%); }
```

## Pflicht-Footer

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

## Kontext

Projekt: Rechnungsautomatisierung (BER-34), Deployment `rgform.berent.ai`.
