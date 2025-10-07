// hooks/useScrollToHash.ts
"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function useScrollToHash(offset = 80) {
    const pathname = usePathname();

    useEffect(() => {
        const hash = window.location.hash?.replace("#", "");
        if (!hash) return;

        const scrollToElement = () => {
            const el = document.getElementById(hash);
            if (!el) return false;

            const top = el.getBoundingClientRect().top + window.scrollY - offset;
            window.scrollTo({ top, behavior: "smooth" });
            return true;
        };

        // Try immediately
        if (scrollToElement()) return;

        // Retry until element exists (handles route load delays)
        let retries = 0;
        const interval = setInterval(() => {
            retries++;
            if (scrollToElement() || retries > 15) {
                clearInterval(interval);
            }
        }, 200);

        return () => clearInterval(interval);
    }, [pathname, offset]);
}
