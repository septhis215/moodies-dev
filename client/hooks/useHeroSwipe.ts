import { useRef, type TouchEvent } from "react";

/** Swipe the artwork/copy without intercepting controls or a scrolling poster rail. */
export function useHeroSwipe({
  onSwipe,
  pause,
  resume,
}: {
  onSwipe: (direction: -1 | 1) => void;
  pause: () => void;
  resume: () => void;
}) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const cancel = () => {
    if (!start.current) return;
    start.current = null;
    resume();
  };

  return {
    onTouchStart: (event: TouchEvent<HTMLElement>) => {
      cancel();
      if (event.touches.length !== 1 ||
        (event.target as Element).closest("button, a, [data-hero-selector]")) return;
      const touch = event.touches[0];
      start.current = { x: touch.clientX, y: touch.clientY, id: touch.identifier };
      pause();
    },
    onTouchEnd: (event: TouchEvent<HTMLElement>) => {
      const origin = start.current;
      if (!origin) return;
      const touch = Array.from(event.changedTouches).find(t => t.identifier === origin.id);
      if (touch) {
        const dx = touch.clientX - origin.x;
        const dy = touch.clientY - origin.y;
        if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.3) {
          onSwipe(dx < 0 ? 1 : -1);
        }
      }
      cancel();
    },
    onTouchCancel: cancel,
  };
}
