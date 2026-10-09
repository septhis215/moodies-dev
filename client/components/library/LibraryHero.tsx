import Link from "next/link";
import { ArrowRight, Bookmark, Heart } from "lucide-react";
import { TmdbImage } from "@/components/ui/TmdbImage";
import { BadgeMascot } from "@/components/ui/BadgeMascot";
import { tmdbImage } from "@/lib/tmdb";
import {
  entryTitle,
  type LibraryEntry,
  type LibraryKind,
} from "./library-state";
import styles from "./LibraryPage.module.css";

export function LibraryHero({
  kind,
  entries,
  displayName,
  ready,
}: {
  kind: LibraryKind;
  entries: LibraryEntry[];
  displayName?: string;
  ready: boolean;
}) {
  const featured = ready
    ? (entries.find((entry) => entry.summary?.backdrop_path) ??
      entries.find((entry) => entry.summary?.poster_path) ??
      entries.find((entry) => entry.summary))
    : undefined;
  const artwork = tmdbImage(
    featured?.summary?.backdrop_path || featured?.summary?.poster_path,
    "w1280",
  );
  const movies = entries.filter((entry) => entry.kind === "movie").length;
  return (
    <>
      <header className={styles.hero}>
        {artwork && (
          <TmdbImage
            src={artwork}
            alt=""
            fill
            sizes="(max-width: 1279px) 100vw, 1280px"
            className={styles.art}
          />
        )}
        <div className={styles.shade} aria-hidden="true" />
        <div className={styles.heroBody}>
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <div className="min-w-0 flex-1">
            <p className={styles.personal}>
              {displayName
                ? `${displayName}’s collection`
                : "Your personal collection"}
            </p>
            <h1
              id="library-heading"
              className="mt-3 text-4xl font-bold leading-none sm:text-5xl"
            >
              {kind === "watchlist" ? "Watchlist" : "Liked titles"}
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-[var(--ink-muted)]">
              {kind === "watchlist"
                ? "The stories you’re saving for the right moment."
                : "The stories that stayed with you. All in one place."}
            </p>
            {ready && (
              <div className={styles.counts} aria-label="Library summary">
                <span>
                  <strong>{entries.length}</strong>{" "}
                  {entries.length === 1 ? "title" : "titles"}
                </span>
                <span>
                  <strong>{movies}</strong> {movies === 1 ? "movie" : "movies"}
                </span>
                <span>
                  <strong>{entries.length - movies}</strong> series
                </span>
              </div>
            )}
            </div>
            <BadgeMascot
              name={kind === "watchlist" ? "watchlist-builder" : "first-like"}
              alt={kind === "watchlist" ? "Your watchlist companion" : "Your favourites companion"}
              reaction={kind === "watchlist" ? "Saving a little magic for movie night." : "Good stories deserve a little love."}
              className="h-20 w-20 sm:h-32 sm:w-32"
              sizes="(max-width: 639px) 80px, 128px"
            />
          </div>
          {featured && (
            <div className={styles.feature}>
              <p className="ui-kicker">
                {kind === "watchlist"
                  ? "From your watchlist"
                  : "One of your favourites"}
              </p>
              <p className={styles.featureTitle}>{entryTitle(featured)}</p>
              <Link
                href={
                  (featured.kind === "movie" ? "/movies/" : "/tv/") +
                  featured.id
                }
                className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--ink)] hover:text-[var(--brand-coral-strong)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]"
              >
                Explore title <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      </header>
      <nav aria-label="Your library" className={styles.nav}>
        <Link
          href="/watchlist"
          aria-current={kind === "watchlist" ? "page" : undefined}
          className={styles.navLink}
        >
          <Bookmark size={16} aria-hidden="true" /> Watchlist
        </Link>
        <Link
          href="/liked"
          aria-current={kind === "liked" ? "page" : undefined}
          className={styles.navLink}
        >
          <Heart size={16} aria-hidden="true" /> Liked titles
        </Link>
      </nav>
    </>
  );
}
