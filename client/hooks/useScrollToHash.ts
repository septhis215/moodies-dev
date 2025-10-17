// hooks/useScrollToHash.ts
"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function useScrollToHash(offset = 80, ignoreIds: string[] = []) {
    const pathname = usePathname();

    useEffect(() => {
        const scrollToElement = (hash?: string) => {
            const id = (hash ?? window.location.hash).replace("#", "");
            if (!id) return false;
            if (ignoreIds.includes(id)) return false;

            const el = document.getElementById(id);
            if (!el) return false;

            const top = el.getBoundingClientRect().top + window.scrollY - offset;
            window.scrollTo({ top, behavior: "smooth" });
            return true;
        };

        // Try immediately (when route changes)
        if (scrollToElement()) return;

        // Retry until element exists (handles async renders)
        let retries = 0;
        const interval = window.setInterval(() => {
            retries++;
            if (scrollToElement() || retries > 15) {
                clearInterval(interval);
            }
        }, 200);

        // Also listen for hashchange events (clicks that only change the fragment)
        const onHashChange = () => {
            // attempt to scroll, honoring ignoreIds
            scrollToElement(window.location.hash);
        };
        window.addEventListener("hashchange", onHashChange);

        return () => {
            clearInterval(interval);
            window.removeEventListener("hashchange", onHashChange);
        };
    }, [pathname, offset, ignoreIds]);
}
