"use client";

import { Printer } from "lucide-react";

export function TermsPdfButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-1)] px-3 py-2 text-sm font-semibold text-[var(--ink)] transition-colors hover:border-[var(--ink-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)] motion-reduce:transition-none print:hidden"
    >
      <Printer className="h-4 w-4" aria-hidden="true" />
      Print / save PDF
    </button>
  );
}
