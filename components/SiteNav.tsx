"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * Fixierte Kopfleiste wie auf berent.ai: Marke links, Farbschema rechts.
 */
export function SiteNav() {
  return (
    <nav
      className="fixed left-0 right-0 top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/92 backdrop-blur-md transition-colors"
      aria-label="Hauptnavigation"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            href="https://berent.ai"
            className="font-[family-name:var(--font-display)] text-lg tracking-[0.1em] text-[var(--gold)] transition hover:text-[var(--copper)] sm:text-xl"
          >
            BERENT
          </Link>
          <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--muted)] sm:text-xs">
            RG-Form
          </span>
        </div>
        <ThemeToggle />
      </div>
    </nav>
  );
}
