"use client";

import { useEffect, useState } from "react";
import { useMounted } from "@/hooks/useMounted";
import { getAuthToken } from "@/utils/getAuthToken";

export default function ClientWatchlist() {
  const mounted = useMounted();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(getAuthToken());
  }, []);

  if (!mounted) {
    return null;
  }

  const tokenPresent = !!token;

  return (
    <section className="px-6 py-4">
      <div className="flex gap-2 mb-3">
        <Badge ok label={`Token: ${tokenPresent ? "present" : "missing"}`} />
      </div>

      <WatchlistContent />
    </section>
  );
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`rounded-full px-2 py-1 text-xs ${ok ? "bg-emerald-500/15 border-emerald-400/40" : "bg-red-500/15 border-red-400/40"} border`}>
      {label}
    </span>
  );
}

function WatchlistContent() {
  return null; 
}
