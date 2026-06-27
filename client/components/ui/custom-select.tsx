"use client";

import { useState } from "react";
import { ChevronDown, Check } from "lucide-react";

type Option<T> = {
  label: string;
  value: T;
};

interface CustomSelectProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  widthClass?: string;
}

export default function CustomSelect<T extends string>({
  value,
  onChange,
  options,
  widthClass = "w-48",
}: CustomSelectProps<T>) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`relative inline-block text-left ${widthClass}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full gap-2
                   bg-white/[0.05] text-white/70 text-xs font-medium
                   rounded-lg px-3 py-2
                   border border-white/[0.07]
                   hover:bg-white/[0.08] hover:border-white/[0.12] hover:text-white
                   focus:outline-none focus:border-[#e94f37]/40
                   transition-all duration-150 cursor-pointer"
      >
        {options.find((o) => o.value === value)?.label}
        <ChevronDown
          size={12}
          className={`text-white/30 transition-transform duration-150 flex-shrink-0 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Click-away overlay */}
          <button
            type="button"
            aria-label="Close options"
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute mt-1.5 w-full z-50
                          bg-zinc-900 border border-white/[0.08]
                          rounded-lg overflow-hidden
                          shadow-[0_8px_24px_rgba(0,0,0,0.5)]
                          animate-in fade-in slide-in-from-top-1 duration-150"
          >
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex items-center justify-between w-full text-left
                            px-3 py-2 text-xs transition-colors duration-100 cursor-pointer
                            ${
                              value === option.value
                                ? "bg-white/[0.07] text-white"
                                : "text-white/50 hover:bg-white/[0.05] hover:text-white"
                            }`}
              >
                {option.label}
                {value === option.value && (
                  <Check size={11} className="text-[#e94f37] flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
