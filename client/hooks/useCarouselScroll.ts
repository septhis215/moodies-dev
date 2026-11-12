"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Page through visible cards at actual snap points; allow an explicit card step. */
export function useCarouselScroll(itemCount: number, step?: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<number | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateAvailability = useCallback((element: HTMLDivElement, position = element.scrollLeft) => {
    const max = Math.max(0, element.scrollWidth - element.clientWidth);
    setCanScrollLeft(position > 2);
    setCanScrollRight(position < max - 2);
  }, []);
  const settle = useCallback((element: HTMLDivElement) => {
    clearTimeout(settleTimerRef.current);
    targetRef.current = null;
    updateAvailability(element);
  }, [updateAvailability]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const onScrollEnd = () => settle(element);
    const onScroll = () => {
      if (targetRef.current === null) updateAvailability(element);
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = setTimeout(onScrollEnd, 180);
    };
    // Wheel/touch navigation takes ownership from any queued button target.
    const observer = new ResizeObserver(onScrollEnd);
    observer.observe(element);
    Array.from(element.children).forEach((child) => observer.observe(child));
    updateAvailability(element);
    element.addEventListener("scroll", onScroll, { passive: true });
    element.addEventListener("scrollend", onScrollEnd);
    element.addEventListener("pointerdown", onScrollEnd, { passive: true });
    element.addEventListener("wheel", onScrollEnd, { passive: true });
    return () => {
      clearTimeout(settleTimerRef.current);
      observer.disconnect();
      targetRef.current = null;
      element.removeEventListener("scroll", onScroll);
      element.removeEventListener("scrollend", onScrollEnd);
      element.removeEventListener("pointerdown", onScrollEnd);
      element.removeEventListener("wheel", onScrollEnd);
    };
  }, [itemCount, settle, updateAvailability]);

  const scroll = useCallback(
    (direction: -1 | 1) => {
      const element = containerRef.current;
      if (!element) return;
      const max = Math.max(0, element.scrollWidth - element.clientWidth);
      const style = getComputedStyle(element);
      const padding = parseFloat(style.paddingLeft) || 0;
      const gap = parseFloat(style.columnGap) || 0;
      const cardWidth = element.firstElementChild?.getBoundingClientRect().width ?? 0;
      const availableWidth = element.clientWidth - padding - (parseFloat(style.paddingRight) || 0);
      // Include the trailing gap in the calculation and tolerate subpixel rounding.
      const pageSize = cardWidth > 0
        ? Math.max(1, Math.floor((availableWidth + gap + 2) / (cardWidth + gap)))
        : 1;
      const origin = element.getBoundingClientRect().left + element.clientLeft;
      const points = [
        0,
        ...Array.from(element.children, (child) =>
          Math.max(
            0,
            Math.min(
              max,
              child.getBoundingClientRect().left -
                origin +
                element.scrollLeft -
                padding,
            ),
          ),
        ),
        max,
      ].filter(
        (point, index, all) => index === 0 || point > all[index - 1] + 2,
      );
      const current = targetRef.current ?? element.scrollLeft;
      const candidates =
        direction === 1
          ? points.filter((point) => point > current + 2)
          : points.filter((point) => point < current - 2).reverse();
      const target =
        candidates[Math.min(Math.max(1, step ?? pageSize), candidates.length) - 1];
      if (target === undefined) return;
      clearTimeout(settleTimerRef.current);
      targetRef.current = target;
      updateAvailability(element, target);
      settleTimerRef.current = setTimeout(() => settle(element), 180);
      element.scrollTo({
        left: target,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    },
    [step, settle, updateAvailability],
  );

  return { containerRef, canScrollLeft, canScrollRight, scroll };
}
