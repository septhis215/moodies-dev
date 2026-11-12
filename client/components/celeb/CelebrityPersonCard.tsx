"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Info } from "lucide-react";
import { TmdbImage } from "@/components/ui/TmdbImage";
import { tmdbImage } from "@/lib/tmdb";
import styles from "./celebrity-hub.module.css";

type Work = {
  id: number;
  title?: string;
  name?: string;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
  adult?: boolean;
};
type Person = {
  id: number;
  name: string;
  profile_path?: string | null;
  known_for_department?: string;
  known_for?: Work[];
};
const recentWorks = new Map<number, Promise<Work[]>>();
function loadWorks(id: number) {
  let request = recentWorks.get(id);
  if (!request) {
    request = fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api"}/people/${id}`,
      { signal: AbortSignal.timeout(8000) },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Credits unavailable");
        const data = await response.json();
        const cast: Work[] = Array.isArray(data.combined_credits?.cast)
          ? data.combined_credits.cast
          : [];
        return cast
          .filter(
            (work) =>
              !work.adult &&
              ["movie", "tv"].includes(work.media_type || "") &&
              Date.parse(work.release_date || work.first_air_date || "") <=
                Date.now(),
          )
          .sort(
            (a, b) =>
              Date.parse(b.release_date || b.first_air_date || "") -
              Date.parse(a.release_date || a.first_air_date || ""),
          )
          .slice(0, 2);
      })
      .catch(() => {
        recentWorks.delete(id);
        return [];
      });
    if (recentWorks.size >= 80)
      recentWorks.delete(recentWorks.keys().next().value!);
    recentWorks.set(id, request);
  }
  return request;
}

export default function CelebrityPersonCard({
  person,
  subtitle,
  priority = false,
}: {
  person: Person;
  subtitle?: string;
  priority?: boolean;
}) {
  const [works, setWorks] = useState<Work[]>(person.known_for || []);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  const [pending, setPending] = useState(false);
  const requested = useRef(false);
  function reveal() {
    if (requested.current) return;
    requested.current = true;
    setPending(true);
    void loadWorks(person.id)
      .then((items) => {
        if (items.length) {
          setWorks(items);
          setLoaded(true);
        }
      })
      .finally(() => setPending(false));
  }
  return (
    <article
      className={styles.personCard}
      onMouseEnter={reveal}
      onFocus={reveal}
    >
      <div className="ui-media-artwork aspect-[4/5]">
        <Link
          href={`/celeb/${person.id}`}
          className="absolute inset-0 block"
          aria-label={person.name}
        >
          <TmdbImage
            src={
              (!broken && tmdbImage(person.profile_path, "w342")) ||
              "/placeholder-person.svg"
            }
            alt={person.name}
            fill
            priority={priority}
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 16vw"
            className="object-cover"
            onError={() => setBroken(true)}
          />
        </Link>
        <button
          type="button"
          aria-label={`Show ${person.name}'s work`}
          aria-expanded={open}
          onClick={() => {
            reveal();
            setOpen(!open);
          }}
          className={`${styles.touchInfo} absolute right-2 top-2 z-10 h-11 w-11 place-items-center rounded-full bg-black/60 text-white`}
        >
          <Info className="h-4 w-4" aria-hidden="true" />
        </button>
        {(works.length > 0 || open || pending) && (
          <div className={styles.personOverlay} data-open={open}>
            <p className="mb-1 text-xs text-white/70">
              {loaded ? "Latest work" : "On screen"}
            </p>
            {works
              .filter((work) => ["movie", "tv"].includes(work.media_type || ""))
              .slice(0, 2)
              .map((work) => (
                <Link
                  key={`${work.media_type}-${work.id}`}
                  href={`/${work.media_type === "tv" ? "tv" : "movies"}/${work.id}`}
                >
                  <span className="line-clamp-2">
                    {work.title || work.name}
                  </span>
                  <ArrowUpRight
                    className="h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                  />
                </Link>
              ))}
            {!works.length &&
              (pending ? (
                <p className="text-xs leading-5 text-white/70">Loading work…</p>
              ) : (
                <Link href={`/celeb/${person.id}#filmography`}>
                  Filmography
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              ))}
          </div>
        )}
      </div>
      <h3 className="mt-3 truncate text-sm font-semibold leading-5 text-[var(--ink)]">
        <Link
          href={`/celeb/${person.id}`}
          className="hover:text-[var(--brand-coral-strong)]"
        >
          {person.name}
        </Link>
      </h3>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--ink-muted)]">
        {subtitle || person.known_for_department || "Cast"}
      </p>
    </article>
  );
}
