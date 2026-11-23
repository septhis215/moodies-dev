"use client";

import type { ReactNode } from "react";
import { useRecoverableSection } from "@/hooks/useRecoverableSection";
import { RailSkeleton } from "@/components/loading/PageSkeleton";
import DeferredSection from "./DeferredSection";
import SectionHeader from "@/components/ui/SectionHeader";

function SectionData<T>({ id, label, endpoint, decode, children }: {
  id: string; label: string; endpoint: string; decode: (data: unknown) => T; children: (data: T) => ReactNode;
}) {
  const state = useRecoverableSection<T>(null, endpoint, decode);
  if (state.loading) return <div id={id} aria-busy="true" className="min-h-96"><span role="status" className="sr-only">Loading {label}</span><RailSkeleton /></div>;
  if (state.error || state.data === null) return <section id={id} aria-label={label}>
    <SectionHeader title={label} />
    <div className="ui-panel mt-4 flex flex-wrap items-center justify-between gap-4 p-5">
      <p className="text-sm text-[var(--ink-muted)]">This section couldn’t load.</p>
      <button type="button" className="ui-secondary-action" onClick={state.retry}>Try again</button>
    </div>
  </section>;
  return children(state.data);
}

export function DeferredSectionData<T>(props: {
  id: string; label: string; endpoint: string; decode: (data: unknown) => T; children: (data: T) => ReactNode;
}) {
  return <DeferredSection id={props.id} label={props.label}><SectionData {...props} /></DeferredSection>;
}

export default DeferredSectionData;
