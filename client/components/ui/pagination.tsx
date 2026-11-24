"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./pagination.module.css";

type Props = {
  currentPage: number;
  totalPages: number;
  totalResults?: number;
  onPageChange: (page: number) => void;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
};

export default function Pagination({ currentPage, totalPages, totalResults, onPageChange, className = "", disabled = false, ariaLabel = "Pagination" }: Props) {
  const count = Math.max(1, Math.floor(totalPages) || 1);
  const current = Math.max(1, Math.min(count, Math.floor(currentPage) || 1));
  const numbers = [...new Set([1, current - 1, current, current + 1, count])].filter(page => page >= 1 && page <= count);
  const pages: (number | string)[] = [];
  numbers.forEach((page, index) => {
    if (index && page - numbers[index - 1] > 1) pages.push(`gap-${page}`);
    pages.push(page);
  });
  const goTo = (page: number) => {
    if (!disabled && page !== current && page >= 1 && page <= count) onPageChange(page);
  };

  return (
    <nav aria-label={ariaLabel} aria-busy={disabled} className={`${styles.pagination} ${className}`}>
      <div className={styles.row}>
        <button type="button" className={styles.step} aria-label="Previous page" disabled={disabled || current === 1} onClick={() => goTo(current - 1)}><ChevronLeft aria-hidden="true" /><span>Previous</span></button>
        <span className={styles.mobileSummary}>Page {current} of {count}</span>
        <div className={styles.pages}>
          {pages.map(page => typeof page === "string" ? <span key={page} className={styles.ellipsis} aria-hidden="true">…</span> : <button type="button" key={page} className={styles.page} aria-label={page === current ? `Page ${page}, current` : `Go to page ${page}`} aria-current={page === current ? "page" : undefined} disabled={disabled} onClick={() => goTo(page)}>{page}</button>)}
        </div>
        <button type="button" className={styles.step} aria-label="Next page" disabled={disabled || current === count} onClick={() => goTo(current + 1)}><span>Next</span><ChevronRight aria-hidden="true" /></button>
      </div>
      {typeof totalResults === "number" && <p className={styles.results}>{totalResults.toLocaleString()} results</p>}
    </nav>
  );
}
