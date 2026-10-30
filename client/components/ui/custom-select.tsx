"use client";

import {
  useLayoutEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import styles from "./custom-select.module.css";

type Option<T> = { label: string; value: T };
interface CustomSelectProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  label?: string;
  widthClass?: string;
}

export default function CustomSelect<T extends string>({
  value,
  onChange,
  options,
  label,
  widthClass = "w-48",
}: CustomSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({
    position: "fixed",
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const typeahead = useRef({ text: "", time: 0 });
  const listboxId = useId();
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selected = options[selectedIndex];

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const below = window.innerHeight - rect.bottom - 14;
      const above = rect.top - 14;
      const height = Math.min(options.length * 48 + 10, 256);
      const upwards = below < height && above > below;
      const maxHeight = Math.max(0, Math.min(256, upwards ? above : below));
      setPosition({
        position: "fixed",
        width: rect.width,
        left: Math.max(
          8,
          Math.min(rect.left, window.innerWidth - rect.width - 8),
        ),
        top: upwards
          ? rect.top - Math.min(height, maxHeight) - 6
          : rect.bottom + 6,
        maxHeight,
      });
    }
    const inside = (target: EventTarget | null) =>
      target instanceof Node &&
      (rootRef.current?.contains(target) || popupRef.current?.contains(target));
    const dismiss = (event: Event) => {
      if (!inside(event.target)) setOpen(false);
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    place();
    optionRefs.current[selectedIndex]?.focus({ preventScroll: true });
    optionRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" });
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("focusin", dismiss);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("focusin", dismiss);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, options.length, selectedIndex]);

  function optionKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowDown") next = (index + 1) % options.length;
    else if (event.key === "ArrowUp")
      next = (index - 1 + options.length) % options.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = options.length - 1;
    else if (event.key === "Tab") {
      setOpen(false);
      triggerRef.current?.focus();
      return;
    } else if (
      event.key.length === 1 &&
      event.key !== " " &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      const now = Date.now();
      const text =
        (now - typeahead.current.time < 500 ? typeahead.current.text : "") +
        event.key.toLowerCase();
      typeahead.current = { text, time: now };
      const match = options.findIndex((option) =>
        option.label.toLowerCase().startsWith(text),
      );
      if (match < 0) return;
      next = match;
    } else return;
    event.preventDefault();
    optionRefs.current[next]?.focus({ preventScroll: true });
    optionRefs.current[next]?.scrollIntoView({ block: "nearest" });
  }

  return (
    <div
      ref={rootRef}
      className={`relative inline-block min-w-0 text-left ${widthClass}`}
    >
      <button
        ref={triggerRef}
        type="button"
        disabled={!options.length}
        aria-label={label ? `${label}: ${selected?.label ?? ""}` : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        className={styles.trigger}
        onClick={() => {
          typeahead.current = { text: "", time: 0 };
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            typeahead.current = { text: "", time: 0 };
            setOpen(true);
          }
        }}
      >
        <span className="min-w-0 flex-1">
          {selected?.label ?? "Choose an option"}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={popupRef}
            id={listboxId}
            role="listbox"
            aria-label={label ?? "Options"}
            className={styles.popup}
            style={position}
          >
            {options.map((option, index) => (
              <button
                key={option.value}
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                type="button"
                role="option"
                aria-selected={option.value === value}
                tabIndex={-1}
                className={styles.option}
                onKeyDown={(event) => optionKey(event, index)}
                onClick={() => {
                  setOpen(false);
                  triggerRef.current?.focus();
                  onChange(option.value);
                }}
              >
                <span className="min-w-0 flex-1">{option.label}</span>
                <Check
                  className={`h-4 w-4 shrink-0 ${option.value === value ? "" : "invisible"}`}
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
