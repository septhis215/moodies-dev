"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { SearchSort } from "./search-state";
import styles from "./search.module.css";

type SelectOption<T extends string> = {
  value: T;
  label: string;
};

type CustomSelectProps<T extends string> = {
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  variant?: "toolbar" | "field";
};

export function SearchCustomSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  variant = "toolbar",
}: CustomSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selected = options[selectedIndex];

  useEffect(() => {
    if (!open) return;

    optionRefs.current[selectedIndex]?.focus();
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnFocusLeave = (event: FocusEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", close);
    document.addEventListener("focusin", closeOnFocusLeave);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("focusin", closeOnFocusLeave);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [open, selectedIndex]);

  const moveFocus = (direction: 1 | -1, currentIndex: number) => {
    const nextIndex =
      (currentIndex + direction + options.length) % options.length;
    optionRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      ref={rootRef}
      className={`${styles.sortMenu} ${variant === "field" ? styles.fieldSelectMenu : ""}`}
    >
      <span className={variant === "toolbar" ? "sr-only" : styles.sortLabel}>
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        className={styles.sortTrigger}
        aria-label={`${label}: ${selected?.label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span>{selected?.label}</span>
        <span
          className={`${styles.sortChevron} ${open ? styles.sortChevronOpen : ""}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label={label}
          className={styles.sortPopover}
        >
          {options.map((option, index) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                type="button"
                role="option"
                aria-selected={active}
                className={styles.sortOption}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    moveFocus(event.key === "ArrowDown" ? 1 : -1, index);
                  }
                  if (event.key === "Home") {
                    event.preventDefault();
                    optionRefs.current[0]?.focus();
                  }
                  if (event.key === "End") {
                    event.preventDefault();
                    optionRefs.current[options.length - 1]?.focus();
                  }
                }}
              >
                <span>{option.label}</span>
                {active ? (
                  <span className={styles.sortCheck} aria-hidden="true">
                    ✓
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function SearchSortSelect(props: {
  label: string;
  value: SearchSort;
  options: SelectOption<SearchSort>[];
  onChange: (value: SearchSort) => void;
}) {
  return <SearchCustomSelect {...props} />;
}
