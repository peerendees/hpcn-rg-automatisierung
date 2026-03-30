import { InvoiceForm } from "@/components/InvoiceForm";

export default function Home() {
  return (
    <div className="relative z-10 flex min-h-full flex-1 flex-col px-4 py-8 sm:px-8 sm:py-12">
      <header className="mx-auto mb-10 w-full max-w-3xl border-b border-[var(--border)] pb-8">
        <div className="flex flex-wrap items-start gap-4">
          <div className="plus-mark mt-1 shrink-0" aria-hidden />
          <div>
            <p className="font-[family-name:var(--font-display)] text-3xl tracking-[0.1em] text-[var(--gold)] sm:text-4xl">
              RG-FORM
            </p>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl tracking-[0.06em] text-[var(--text)] sm:text-3xl">
              RECHNUNGSAUTOMATISIERUNG
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--muted)]">
              CSV aus der Zeiterfassung einlesen, Positionen und Summen prüfen,
              Rechnung als DOCX oder PDF exportieren — Prototyp hpcn.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col pb-16">
        <InvoiceForm />
      </main>

      <footer className="relative z-10 mx-auto mt-auto flex w-full max-w-3xl flex-wrap items-center gap-x-6 gap-y-3 border-t border-[var(--border)] pt-8 text-sm text-[var(--muted)]">
        <div className="flex items-center gap-2">
          <div className="plus-mark" aria-hidden />
          <span className="font-[family-name:var(--font-display)] tracking-wide text-[var(--gold)]">
            BERENT
          </span>
        </div>
        <span className="font-mono text-xs">RG-Form · berent.ai</span>
        <div className="flex flex-wrap gap-4 font-mono text-xs">
          <a
            href="https://berent.ai/impressum.html"
            className="text-[var(--muted)] underline decoration-[var(--copper)] underline-offset-2 hover:text-[var(--text)]"
          >
            Impressum
          </a>
          <a
            href="https://berent.ai"
            className="text-[var(--muted)] underline decoration-[var(--copper)] underline-offset-2 hover:text-[var(--text)]"
          >
            ← Zurück zur Hauptseite
          </a>
        </div>
      </footer>
    </div>
  );
}
