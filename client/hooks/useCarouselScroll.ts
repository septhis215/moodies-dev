"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Navigate actual snap points, not guessed widths or an in-flight scroll offset. */
export function useCarouselScroll(itemCount: number, step = 1) {
  const containerRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<number | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = () => {
      const max = Math.max(0, element.scrollWidth - element.clientWidth);
      setCanScrollLeft(element.scrollLeft > 2);
      setCanScrollRight(element.scrollLeft < max - 2);
    };
    const settle = () => {
      clearTimeout(settleTimerRef.current);
      targetRef.current = null;
      update();
    };
    const onScroll = () => {
      update();
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = setTimeout(settle, 180);
    };
    const onResize = () => {
      targetRef.current = null;
      update();
    };
    // Wheel/touch navigation takes ownership from any queued button target.
    const cancelTarget = () => {
      targetRef.current = null;
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(element);
    Array.from(element.children).forEach((child) => observer.observe(child));
    update();
    element.addEventListener("scroll", onScroll, { passive: true });
    element.addEventListener("scrollend", settle);
    element.addEventListener("pointerdown", cancelTarget, { passive: true });
    element.addEventListener("wheel", cancelTarget, { passive: true });
    return () => {
      clearTimeout(settleTimerRef.current);
      observer.disconnect();
      targetRef.current = null;
      element.removeEventListener("scroll", onScroll);
      element.removeEventListener("scrollend", settle);
      element.removeEventListener("pointerdown", cancelTarget);
      element.removeEventListener("wheel", cancelTarget);
    };
  }, [itemCount]);

  const scroll = useCallback(
    (direction: -1 | 1) => {
      const element = containerRef.current;
      if (!element) return;
      const max = Math.max(0, element.scrollWidth - element.clientWidth);
      const padding = parseFloat(getComputedStyle(element).paddingLeft) || 0;
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
        candidates[Math.min(Math.max(1, step), candidates.length) - 1];
      if (target === undefined) return;
      clearTimeout(settleTimerRef.current);
      targetRef.current = target;
      element.scrollTo({
        left: target,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    },
    [step],
  );

  return { containerRef, canScrollLeft, canScrollRight, scroll };
}
