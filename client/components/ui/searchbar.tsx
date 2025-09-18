// components/ui/SearchBar.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { IconSearch, IconX } from "@tabler/icons-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { createPortal } from "react-dom";

export default function SearchBar({
  placeholder = "Search movies, series...",
  onSearch,
}: {
  placeholder?: string;
  onSearch?: (q: string) => void;
}) {
  const [open, setOpen] = useState(false); // desktop inline open
  const [value, setValue] = useState("");
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // mobile modal state
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [targetWidth, setTargetWidth] = useState<number>(320);

  const prefersReduced = useReducedMotion();

  // Compute mobile breakpoint & target width safely (client-only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 639px)");
    const onChange = () => {
      setIsMobile(mq.matches);
      setTargetWidth(mq.matches ? 160 : 320);
    };
    onChange();
    // prefer matchMedia change events to avoid reacting to keyboard-driven viewport resizes
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);

    // cleanup
    return () => {
      try {
        if (mq.removeEventListener) mq.removeEventListener("change", onChange);
        else mq.removeListener(onChange);
      } catch {}
    };
  }, []);

  // Focus the inline input when opened (desktop)
  useEffect(() => {
    if (open && !isMobile) inputRef.current?.focus();
  }, [open, isMobile]);

  // track latest mobileOpen in a ref
  const mobileOpenRef = useRef(mobileOpen);
  useEffect(() => {
    mobileOpenRef.current = mobileOpen;
  }, [mobileOpen]);

  // click outside & escape to close inline desktop input
  useEffect(() => {
    const onDocPointer = (e: PointerEvent) => {
      // if mobile modal is open, ignore outside clicks
      if (mobileOpenRef.current) return;
      if (!wrapperRef.current) return;
      if (!(wrapperRef.current as HTMLElement).contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setMobileOpen(false);
      }
    };

    document.addEventListener("pointerdown", onDocPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function submit(e?: React.FormEvent, q?: string) {
    e?.preventDefault();
    const query = (typeof q === "string" ? q : value).trim();
    if (query) {
      onSearch?.(query);
    }
  }

  // Mobile modal node for portal — mobile input manages its own local state to avoid re-renders
  const MobileModal = () => {
    if (typeof document === "undefined") return null;

    // local state for mobile input (isolated from desktop value)
    const [mobileValue, setMobileValue] = useState<string>(value);

    return createPortal(
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="search-mobile"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            className="fixed inset-0 z-[9999] flex items-start justify-center pt-20 bg-[rgba(0,0,0,0.75)]"
            // do not close on backdrop click if you want X-only close; current behavior closes on backdrop
            onClick={() => setMobileOpen(false)}
          >
            <motion.form
              onClick={(e) => e.stopPropagation()}
              initial={prefersReduced ? {} : { y: -12, opacity: 0 }}
              animate={prefersReduced ? {} : { y: 0, opacity: 1 }}
              exit={prefersReduced ? {} : { y: -12, opacity: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 28 }}
              className="w-full max-w-lg px-6"
              onSubmit={(e) => {
                submit(e, mobileValue);
                // keep desktop value in sync optionally
                setValue(mobileValue);
                setMobileOpen(false);
              }}
              // Focus input only after animation completes to avoid focus loss caused by resize/animation
              onAnimationComplete={() => {
                // slight safety: find the input inside portal and focus it
                const el = document.querySelector<HTMLInputElement>(
                  "#search-mobile-input"
                );
                el?.focus();
              }}
            >
              <div className="relative">
                <input
                  id="search-mobile-input"
                  value={mobileValue}
                  onChange={(e) => setMobileValue(e.target.value)}
                  placeholder={placeholder}
                  className="w-full rounded-full px-4 py-3 bg-white/6 text-white placeholder:text-gray-300 outline-none"
                  aria-label="Search"
                />
                <button
                  type="button"
                  aria-label="Close search"
                  onClick={() => setMobileOpen(false)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 bg-white/6 hover:bg-white/10"
                >
                  <IconX className="text-white" />
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    );
  };

  // If we haven't determined mobile/desktop yet, render just the icon (safe)
  const resolvedIsMobile = isMobile === null ? false : isMobile;

  return (
    <>
      <div ref={wrapperRef} className="flex items-center gap-2">
        {/* container uses row-reverse so the input grows to the left of the icon */}
        <div className="flex items-center flex-row-reverse">
          {/* Search icon toggles open/close (desktop) or opens mobile modal */}
          <button
            type="button"
            aria-expanded={open || mobileOpen}
            aria-label={open || mobileOpen ? "Close search" : "Open search"}
            onClick={() => {
              if (resolvedIsMobile) {
                setMobileOpen((s) => !s);
              } else {
                setOpen((s) => !s);
              }
            }}
            className="ml-2 rounded-md border border-white/20 bg-white/5 px-3 py-2 text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <IconSearch />
          </button>

          {/* Animated field wrapper — width animates, so input expands leftward (desktop only) */}
          <motion.form
            onSubmit={(e) => {
              submit(e);
              // on desktop we can keep it open or close on search; keep open by default
            }}
            initial={false}
            animate={{ width: open && !resolvedIsMobile ? targetWidth : 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 28 }}
            className="overflow-hidden"
            style={{ display: "inline-block" }}
          >
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  submit();
                }
              }}
              placeholder={placeholder}
              className="w-full bg-white/6 placeholder:text-gray-300 text-white rounded-full px-4 py-2 text-sm outline-none focus:ring-0"
              style={{
                // ensure the input height matches the button
                height: 36,
              }}
              aria-label="Search"
            />
          </motion.form>
        </div>
      </div>

      {/* Mobile portal modal */}
      <MobileModal />
    </>
  );
}
