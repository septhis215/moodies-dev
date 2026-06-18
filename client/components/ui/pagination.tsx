import React, { useMemo, useState, useEffect, useRef } from "react";

type Props = {
    currentPage: number;
    totalPages: number;
    totalResults?: number;
    onPageChange: (page: number) => void;
    className?: string;
};

export default function Pagination({
    currentPage,
    totalPages,
    totalResults,
    onPageChange,
    className = "",
}: Props) {
    const [isMobile, setIsMobile] = useState<boolean>(false);
    const [isTinyMobile, setIsTinyMobile] = useState<boolean>(false);
    const pagesRef = useRef<HTMLDivElement | null>(null);

    // detect breakpoints
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 640);
            setIsTinyMobile(window.innerWidth < 400);
        };
        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // scroll active into view on small screens
    useEffect(() => {
        if ((!isMobile && !isTinyMobile) || !pagesRef.current) return;
        const container = pagesRef.current;
        const active = container.querySelector<HTMLElement>("[aria-current='true']");
        if (!active) return;

        const left =
            active.offsetLeft - (container.clientWidth - active.clientWidth) / 2;
        container.scrollTo({
            left: Math.max(0, left),
            behavior: "smooth",
        });
    }, [currentPage, isMobile, isTinyMobile]);

    // helper to create numeric range
    const range = (start: number, end: number) => {
        const out: number[] = [];
        for (let i = start; i <= end; i++) out.push(i);
        return out;
    };

    // build the visible pages according to screen size rules
    const visiblePages = useMemo<(number | "...")[]>(() => {
        // guard
        if (totalPages <= 1) return [1];

        // tiny mobile: only 3 pages max, no ellipses
        if (isTinyMobile) {
            if (totalPages <= 3) return range(1, totalPages);
            if (currentPage === 1) return [1, 2, 3];
            if (currentPage === totalPages) return [totalPages - 2, totalPages - 1, totalPages];
            return [currentPage - 1, currentPage, currentPage + 1];
        }

        // if very small number of pages, show all
        if (totalPages <= 5) {
            return range(1, totalPages);
        }

        // mobile: current ±1 with first/last + ellipses
        if (isMobile) {
            const delta = 1;
            const left = Math.max(2, currentPage - delta);
            const right = Math.min(totalPages - 1, currentPage + delta);
            const pages: (number | "...")[] = [];
            pages.push(1);

            if (left > 2) {
                pages.push("...");
            } else {
                // include contiguous pages after 1 if no ellipses
                for (let p = 2; p < left; p++) pages.push(p);
            }

            for (let p = left; p <= right; p++) pages.push(p);

            if (right < totalPages - 1) {
                pages.push("...");
            } else {
                for (let p = right + 1; p <= totalPages - 1; p++) pages.push(p);
            }

            pages.push(totalPages);

            // filter duplicates (safety) and invalid numbers
            return pages.filter((v, i, a) => {
                if (typeof v === "number") {
                    if (v < 1 || v > totalPages) return false;
                }
                return i === 0 || v !== a[i - 1];
            });
        }

        // desktop: current ±2 with first/last + ellipses
        {
            const delta = 2;
            const left = Math.max(2, currentPage - delta);
            const right = Math.min(totalPages - 1, currentPage + delta);
            const pages: (number | "...")[] = [];
            pages.push(1);

            if (left > 2) pages.push("...");
            else for (let p = 2; p < left; p++) pages.push(p);

            for (let p = left; p <= right; p++) pages.push(p);

            if (right < totalPages - 1) pages.push("...");
            else for (let p = right + 1; p <= totalPages - 1; p++) pages.push(p);

            pages.push(totalPages);

            return pages.filter((v, i, a) => {
                if (typeof v === "number") {
                    if (v < 1 || v > totalPages) return false;
                }
                return i === 0 || v !== a[i - 1];
            });
        }
    }, [currentPage, totalPages, isMobile, isTinyMobile]);

    const goTo = (page: number) => {
        const next = Math.max(1, Math.min(totalPages, Math.floor(page)));
        if (next !== currentPage) onPageChange(next);
    };

    return (
        <nav aria-label="Pagination" className={`w-full ${className}`}>
            <div className="flex items-center justify-center gap-3 flex-wrap">
                {/* Prev
                <button
                    onClick={() => goTo(currentPage - 1)}
                    disabled={currentPage === 1}
                    aria-label="Previous page"
                    className={`${btnBase} px-3 py-2 ${currentPage === 1 ? "opacity-40 cursor-not-allowed" : "bg-gray-700/60 hover:bg-gray-700/80 text-white"}`}
                >
                    <ChevronLeft size={16} />
                </button> */}

                {/* Pages strip */}
                <div ref={pagesRef} className="flex gap-2 overflow-x-auto no-scrollbar py-1 px-1">
                    {visiblePages.map((p, idx) =>
                        p === "..." ? (
                            <div key={`dots-${idx}`} className="w-10 h-10 flex items-center justify-center text-gray-400 shrink-0">
                                …
                            </div>
                        ) : (
                            <button
                                key={p}
                                onClick={() => goTo(p as number)}
                                aria-current={p === currentPage ? "true" : undefined}
                                className={`w-10 h-10 text-sm font-medium rounded-md shrink-0 ${p === currentPage ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md" : "bg-gray-800/60 text-gray-200 hover:bg-gray-700/80"
                                    }`}
                                aria-label={p === currentPage ? `Page ${p}, current` : `Go to page ${p}`}
                            >
                                {p}
                            </button>
                        )
                    )}
                </div>

                {/* Next
                <button
                    onClick={() => goTo(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    aria-label="Next page"
                    className={`${btnBase} px-3 py-2 ${currentPage === totalPages ? "opacity-40 cursor-not-allowed" : "bg-gray-700/60 hover:bg-gray-700/80 text-white"}`}
                >
                    <ChevronRight size={16} />
                </button> */}
            </div>

            {/* Page info */}
            <div className="mt-2 text-xs text-gray-400 text-center">
                Page <span className="text-gray-100 font-semibold">{currentPage}</span> of {totalPages}
                {typeof totalResults === "number" && <> • {totalResults.toLocaleString()} results</>}
            </div>
        </nav>
    );
}
