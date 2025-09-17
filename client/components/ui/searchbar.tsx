// components/ui/SearchBar.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { IconSearch } from "@tabler/icons-react";
import { motion } from "framer-motion";

export default function SearchBar({
  placeholder = "Search movies, series...",
  onSearch,
}: {
  placeholder?: string;
  onSearch?: (q: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // click outside & escape to close
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const q = value.trim();
    if (q) {
      onSearch?.(q);
      // keep open or close depending on your preference:
      // setOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className="flex items-center gap-2">
      {/* container uses row-reverse so the input grows to the left of the icon */}
      <div className="flex items-center flex-row-reverse">
        {/* Search icon toggles open/close */}
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? "Close search" : "Open search"}
          onClick={() => setOpen((s) => !s)}
          className="ml-2 rounded-md border border-white/20 bg-white/5 px-3 py-2 text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <IconSearch />
        </button>

        {/* Animated field wrapper — width animates, so input expands leftward */}
        <motion.form
          onSubmit={(e) => {
            submit(e);
          }}
          initial={false}
          animate={{ width: open ? (window.innerWidth < 640 ? 160 : 320) : 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 28 }}
          className="overflow-hidden"
          style={{ display: "inline-block" }}
        >
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
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
  );
}
