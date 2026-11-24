type ReleaseInfo = {
  releaseDate?: string | null;
  status?: string | null;
};

/** Movie premiere or TV first-air date, never the next episode's air date. */
export function isMediaReleased(
  { releaseDate, status }: ReleaseInfo,
  today = new Date().toISOString().slice(0, 10),
): boolean {
  const date = releaseDate?.trim();
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date)
      return date <= today;
  }
  return ["released", "returning series", "ended", "canceled", "cancelled"]
    .includes(status?.trim().toLowerCase() ?? "");
}
