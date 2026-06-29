"use client";

import { Download } from "lucide-react";

export function TermsPdfButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex w-fit items-center gap-2 rounded-lg bg-[rgb(233,79,55)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(233,79,55,0.24)] transition hover:bg-[rgb(215,65,42)] print:hidden"
    >
      <Download className="h-4 w-4" aria-hidden />
      Export PDF
    </button>
  );
}
