/** Release status is independent of the title's rating. Compare calendar dates. */
export function getReleaseStatus(
  date: string | undefined,
  today = new Date(),
): "upcoming" | "released" | "unknown" {
  if (
    !date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(date))
  )
    return "unknown";
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return date > localDate ? "upcoming" : "released";
}

/** Ignore taps and horizontal/diagonal gestures; upward movement advances. */
export function getSwipeDirection(dx: number, dy: number): -1 | 1 | 0 {
  if (Math.abs(dy) < 60 || Math.abs(dy) <= Math.abs(dx) * 1.5) return 0;
  return dy < 0 ? 1 : -1;
}

export function normalizeWheelDelta(
  delta: number,
  mode: number,
  pageHeight: number,
): number {
  return delta * (mode === 1 ? 16 : mode === 2 ? pageHeight : 1);
}
