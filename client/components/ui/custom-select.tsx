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
  widthClass?: string; // e.g. "w-48" or "w-full"
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
        className="flex items-center justify-between w-full gap-2 bg-slate-800/70 backdrop-blur-sm text-slate-200 font-medium rounded-lg px-4 py-2 border border-white/10 hover:border-white/20 focus:border-white/30 focus:ring-1 focus:ring-white/20 text-sm transition-all cursor-pointer"
      >
        {options.find((o) => o.value === value)?.label}
        <ChevronDown
          size={16}
          className={`text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div className="absolute mt-2 w-full bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-lg shadow-lg overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`flex items-center justify-between w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer
                ${
                  value === option.value
                    ? "bg-white/10 text-white"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
            >
              {option.label}
              {value === option.value && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
