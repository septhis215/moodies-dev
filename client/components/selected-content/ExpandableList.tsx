"use client";

import { useId, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export function ExpandableList<T>({ items, limit, label, renderItem, className = '' }: {
  items: T[]; limit: number; label: string; renderItem: (item: T) => ReactNode; className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const reducedMotion = useReducedMotion();
  const more = items.length - limit;
  return (
    <div>
      <ul className={className}>{items.slice(0, limit).map(renderItem)}</ul>
      <div id={id}>
        <AnimatePresence initial={false}>
          {expanded && more > 0 ? <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.24, ease: 'easeInOut' }} className="overflow-hidden">
            <ul className={className}>{items.slice(limit).map(renderItem)}</ul>
          </motion.div> : null}
        </AnimatePresence>
      </div>
      {more > 0 ? <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-controls={id}
        className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-coral-strong focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-coral-strong">
        {expanded ? `Show fewer ${label}` : `Show all ${items.length} ${label}`}
        <ChevronDown size={16} className={`transition-transform motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button> : null}
    </div>
  );
}
