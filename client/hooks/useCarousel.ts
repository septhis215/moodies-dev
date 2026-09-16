import { useCallback, useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export default function useCarousel({ length, intervalMs = 7000 }: { length: number; intervalMs?: number }) {
    const [index, setIndex] = useState(0);
    const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

    const timer = useRef<number | null>(null);
    const paused = useRef(false);

    useEffect(() => {
        setIndex((current) => length > 0 ? Math.min(current, length - 1) : 0);
    }, [length]);

    const clearTimer = useCallback(() => {
        if (timer.current) {
            window.clearInterval(timer.current);
            timer.current = null;
        }
    }, []);

    const startTimer = useCallback(() => {
        if (timer.current) clearTimer();
        if (length <= 1) return;
        timer.current = window.setInterval(() => {
            setIndex((i) => (length ? (i + 1) % length : 0));
        }, intervalMs);
    }, [clearTimer, intervalMs, length]);

    useEffect(() => {
        if (length <= 1 || prefersReducedMotion || document.visibilityState === 'hidden') return;
        startTimer();
        return () => clearTimer();
    }, [clearTimer, length, prefersReducedMotion, startTimer]);

    const pause = () => {
        paused.current = true;
        clearTimer();
    };

    const resume = () => {
        if (!paused.current || prefersReducedMotion || document.visibilityState === 'hidden') return;
        paused.current = false;
        startTimer();
    };

    useEffect(() => {
        if (length <= 1) return;

        function onKey(e: KeyboardEvent) {
            const target = e.target as HTMLElement | null;
            if (
                target?.closest('input, textarea, select, button, [contenteditable="true"]')
            ) return;
            if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + length) % length);
            if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % length);
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [length]);

    useEffect(() => {
        if (length <= 1) return;

        const onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                clearTimer();
            } else if (!paused.current && !prefersReducedMotion) {
                startTimer();
            }
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, [clearTimer, length, prefersReducedMotion, startTimer]);

    return { index, setIndex, pause, resume };
}
