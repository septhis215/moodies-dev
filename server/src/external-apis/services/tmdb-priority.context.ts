import { AsyncLocalStorage } from 'async_hooks';

/**
 * Bottleneck priority levels (lower number = runs first).
 * Foreground = user-facing page loads. Background = pre-warming / enrichment
 * that must never block a real request.
 */
export const TMDB_PRIORITY = {
    FOREGROUND: 5,
    BACKGROUND: 9,
} as const;

const storage = new AsyncLocalStorage<{ priority: number }>();

/**
 * Run `fn` (and everything it awaits) under a given TMDB scheduling priority.
 * The rate limiter reads this via currentTmdbPriority() when it queues a call,
 * so wrapping a background task here makes every TMDB call it triggers yield to
 * foreground requests — no need to thread a priority argument through call sites.
 */
export function runWithTmdbPriority<T>(priority: number, fn: () => Promise<T>): Promise<T> {
    return storage.run({ priority }, fn);
}

export function currentTmdbPriority(): number {
    return storage.getStore()?.priority ?? TMDB_PRIORITY.FOREGROUND;
}
