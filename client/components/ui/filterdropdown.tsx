import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";

type Option<T> = {
    label: string;
    value: T;
};

export function FilterDropdown<T extends string>({
    value,
    options,
    onChange,
}: {
    value: T;
    options: Option<T>[];
    onChange: (value: T) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (!ref.current?.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const selected = options.find(o => o.value === value);

    return (
        <div ref={ref} className="relative">
            {/* Trigger */}
            <button
                onClick={() => setOpen(v => !v)}
                className="
          h-9 min-w-[140px]
          px-3
          rounded-xl
          bg-neutral-900
          border border-white/10
          text-sm text-white
          flex items-center justify-between gap-2
          hover:border-white/20
          focus:outline-none focus:ring-2 focus:ring-[#e94f37]/50
          transition
        "
            >
                <span>{selected?.label}</span>
                <ChevronDown className={`w-4 h-4 transition ${open ? "rotate-180" : ""}`} />
            </button>

            {/* Dropdown */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className="
              absolute z-50 mt-2 w-full
              rounded-xl
              bg-neutral-900
              border border-white/10
              shadow-xl
              overflow-hidden
            "
                    >
                        {options.map(opt => {
                            const active = opt.value === value;
                            return (
                                <button
                                    key={opt.value}
                                    onClick={() => {
                                        onChange(opt.value);
                                        setOpen(false);
                                    }}
                                    className={`
                    w-full px-3 py-2.5 text-sm
                    flex items-center justify-between
                    transition
                    ${active
                                            ? "bg-[#e94f37]/20 text-[#e94f37]"
                                            : "text-gray-300 hover:bg-white/5"}
                  `}
                                >
                                    {opt.label}
                                    {active && <Check className="w-4 h-4" />}
                                </button>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
