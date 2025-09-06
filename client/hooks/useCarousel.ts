import { useEffect, useRef, useState } from 'react';

export default function useCarousel({ length, intervalMs = 7000 }: { length: number; intervalMs?: number }) {
    const [index, setIndex] = useState(0);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const timer = useRef<number | null>(null);
    const paused = useRef(false);

    const clearTimer = () => {
        if (timer.current) {
            window.clearInterval(timer.current);
            timer.current = null;
        }
    };

    const startTimer = () => {
        if (timer.current) clearTimer();
        if (length <= 1) return;
        timer.current = window.setInterval(() => {
            setIndex((i) => (length ? (i + 1) % length : 0));
        }, intervalMs);
    };

    useEffect(() => {
        if (!mounted) return;
        startTimer();
        return () => clearTimer();
    }, [mounted, length, intervalMs]);

    const pause = () => {
        paused.current = true;
        clearTimer();
    };

    const resume = () => {
        if (!paused.current) return;
        paused.current = false;
        startTimer();
    };

    useEffect(() => {
        if (!mounted) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + length) % length);
            if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % length);
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [mounted, length]);

    return { index, setIndex, pause, resume };
}
