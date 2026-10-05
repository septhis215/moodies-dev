"use client";

import {
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  Search,
  Star,
} from "lucide-react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import AppLoading from "@/components/ui/AppLoading";
import { tmdbImage } from "@/lib/tmdb";
import { useWatchlist } from "@/hooks/useWatchlist";
import CelebrityMediaSections from "@/components/celeb/CelebrityMediaSections";
import CelebrityPortrait from "@/components/celeb/CelebrityPortrait";
import PeopleRail from "@/components/celeb/PeopleRail";
import type { CelebrityPhoto } from "@/types/celebrityMedia";

interface Credit {
  id: number;
  title?: string;
  name?: string;
  character?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  popularity?: number;
  release_date?: string;
  first_air_date?: string;
  media_type: "movie" | "tv" | string;
  genre_ids?: number[];
}

interface Person {
  id: number;
  name: string;
  biography?: string;
  birthday?: string;
  deathday?: string;
  place_of_birth?: string;
  profile_path?: string | null;
  known_for_department?: string;
  popularity?: number;
  gender?: number;
  also_known_as?: string[];
  homepage?: string;
  external_ids?: {
    instagram_id?: string;
    twitter_id?: string;
    facebook_id?: string;
    imdb_id?: string;
  };
  images?: {
    profiles?: Array<{
      file_path: string;
      vote_average?: number;
      aspect_ratio?: number;
    }>;
  };
  combined_credits?: {
    cast?: Credit[];
  };
  tagged_images?: {
    results?: Array<{
      file_path: string;
      vote_average?: number;
      media?: {
        id: number;
        title?: string;
        name?: string;
        media_type: "movie" | "tv";
        vote_average?: number;
      };
    }>;
  };
}

interface SimilarPerson {
  id: number;
  name: string;
  profile_path?: string | null;
  known_for_department?: string;
  popularity?: number;
  relationship?: string;
}

interface Collaboration {
  id: number;
  name: string;
  count: number;
  projects?: string[];
  profile_path?: string | null;
}

type FilmographyTab = "all" | "movies" | "tv";
type SortMode = "notable" | "latest" | "rating" | "oldest";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_NEST_API_URL ||
  "https://dev.api.moodies.tech/api";

const genreMap: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
};

const getTitle = (credit: Credit) => credit.title || credit.name || "Untitled";
const getDate = (credit: Credit) =>
  credit.release_date || credit.first_air_date || "";
const getYear = (credit: Credit) => getDate(credit).slice(0, 4) || "Date TBA";
const getHref = (credit: Credit) =>
  `/${credit.media_type === "tv" ? "tv" : "movies"}/${credit.id}`;
const sortOptions: { value: SortMode; label: string }[] = [
  { value: "notable", label: "Most notable" },
  { value: "latest", label: "Latest first" },
  { value: "rating", label: "Highest rated" },
  { value: "oldest", label: "Oldest first" },
];
function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}
function SectionHeading({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <h2
        id={id}
        className="text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl"
      >
        {title}
      </h2>
      {children}
    </header>
  );
}
function CreditCard({
  credit,
  onSave,
  saved,
  busy,
}: {
  credit: Credit;
  onSave: (credit: Credit) => void;
  saved: boolean;
  busy?: boolean;
}) {
  return (
    <article className="min-w-0">
      <div className="relative">
        <Link
          href={getHref(credit)}
          aria-label={`Explore ${getTitle(credit)}`}
          className="group relative block aspect-[2/3] overflow-hidden rounded-lg bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand-coral-strong)]"
        >
          <Image
            src={
              tmdbImage(credit.poster_path, "w342") || "/placeholder-poster.svg"
            }
            alt={getTitle(credit)}
            fill
            sizes="(max-width: 639px) 45vw, (max-width: 1023px) 25vw, 200px"
            className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
          />
        </Link>
        <button
          type="button"
          onClick={() => onSave(credit)}
          disabled={busy}
          aria-label={`${saved ? "Remove" : "Save"} ${getTitle(credit)} ${saved ? "from" : "to"} your watchlist`}
          aria-pressed={saved}
          className={`absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/75 transition-colors hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral-strong)] disabled:cursor-wait disabled:opacity-60 ${saved ? "text-[var(--brand-coral-strong)]" : "text-white"}`}
        >
          {busy ? (
            <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin" />
          ) : saved ? (
            <BookmarkCheck className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Bookmark className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>
      <h3 className="mt-3 min-h-10 line-clamp-2 break-words text-sm font-semibold leading-5 text-[var(--ink)]">
        <Link
          href={getHref(credit)}
          className="hover:text-[var(--brand-coral-strong)]"
        >
          {getTitle(credit)}
        </Link>
      </h3>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-[var(--ink-muted)]">
        <span>{getYear(credit)}</span>
        <span>{credit.media_type === "tv" ? "Series" : "Movie"}</span>
        {!!credit.vote_average && (
          <span
            className="inline-flex items-center gap-1"
            aria-label={`TMDB rating ${credit.vote_average.toFixed(1)} out of 10`}
          >
            <Star
              className="h-3 w-3 text-[var(--brand-gold)]"
              aria-hidden="true"
            />
            {credit.vote_average.toFixed(1)}
          </span>
        )}
      </div>
      {credit.character && (
        <p className="mt-1 line-clamp-1 text-xs leading-5 text-[var(--ink-muted)]">
          {credit.character}
        </p>
      )}
    </article>
  );
}
function ExternalLinks({ person }: { person: Person }) {
  const links = [
    person.external_ids?.instagram_id && {
      label: "Instagram",
      href: `https://www.instagram.com/${person.external_ids.instagram_id}`,
    },
    person.external_ids?.twitter_id && {
      label: "X",
      href: `https://x.com/${person.external_ids.twitter_id}`,
    },
    person.external_ids?.facebook_id && {
      label: "Facebook",
      href: `https://www.facebook.com/${person.external_ids.facebook_id}`,
    },
    person.external_ids?.imdb_id && {
      label: "IMDb",
      href: `https://www.imdb.com/name/${person.external_ids.imdb_id}`,
    },
    person.homepage && { label: "Website", href: person.homepage },
  ].filter((link): link is { label: string; href: string } =>
    Boolean(link && /^https?:\/\//i.test(link.href)),
  );
  return links.length ? (
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1">
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]"
        >
          {link.label}
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </a>
      ))}
    </div>
  ) : null;
}

export default function CelebrityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { add, remove, isInWatchlist, ready } = useWatchlist();
  const [person, setPerson] = useState<Person | null>(null);
  const [collaborations, setCollaborations] = useState<Collaboration[]>([]);
  const [similarPeople, setSimilarPeople] = useState<SimilarPerson[]>([]);
  const [upcomingProjects, setUpcomingProjects] = useState<Credit[]>([]);
  const [loading, setLoading] = useState(true);
  const [collaborationsLoading, setCollaborationsLoading] = useState(false);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [upcomingLoading, setUpcomingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [selectedTab, setSelectedTab] = useState<FilmographyTab>("all");
  const [sortMode, setSortMode] = useState<SortMode>("notable");
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(12);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [extraPhotos, setExtraPhotos] = useState<CelebrityPhoto[]>([]);
  const onPhotosReady = useCallback(
    (photos: CelebrityPhoto[]) => setExtraPhotos(photos),
    [],
  );
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>(
    {},
  );

  useEffect(() => {
    const controller = new AbortController();

    const fetchPerson = async () => {
      setLoading(true);
      setError(null);
      setPerson(null);
      setExtraPhotos([]);
      setBioExpanded(false);
      setSelectedTab("all");
      setQuery("");
      setVisibleCount(12);
      setCollaborationsLoading(false);
      setSimilarLoading(false);
      setUpcomingLoading(false);
      setCollaborations([]);
      setSimilarPeople([]);
      setUpcomingProjects([]);
      try {
        const base = API_BASE;
        const personRes = await fetch(`${base}/people/${resolvedParams.id}`, {
          signal: controller.signal,
        });

        if (!personRes.ok)
          throw new Error("Unable to load this celebrity profile.");

        const personData = await personRes.json();
        if (controller.signal.aborted) return;

        setPerson(personData);
        setLoading(false);

        setSimilarLoading(true);
        fetch(`${base}/people/${resolvedParams.id}/similar`, {
          signal: controller.signal,
        })
          .then(async (similarRes) => (similarRes.ok ? similarRes.json() : []))
          .then((similarData) => {
            if (!controller.signal.aborted) {
              setSimilarPeople(Array.isArray(similarData) ? similarData : []);
            }
          })
          .catch((sectionError) => {
            if (!controller.signal.aborted) {
              console.error(
                "Error fetching similar celebrities:",
                sectionError,
              );
              setSimilarPeople([]);
            }
          })
          .finally(() => {
            if (!controller.signal.aborted) setSimilarLoading(false);
          });

        setUpcomingLoading(true);
        fetch(`${base}/people/${resolvedParams.id}/upcoming`, {
          signal: controller.signal,
        })
          .then(async (upcomingRes) =>
            upcomingRes.ok ? upcomingRes.json() : { movies: [], tv: [] },
          )
          .then((upcomingData) => {
            if (!controller.signal.aborted) {
              setUpcomingProjects([
                ...(upcomingData?.movies || []),
                ...(upcomingData?.tv || []),
              ]);
            }
          })
          .catch((sectionError) => {
            if (!controller.signal.aborted) {
              console.error("Error fetching upcoming projects:", sectionError);
              setUpcomingProjects([]);
            }
          })
          .finally(() => {
            if (!controller.signal.aborted) setUpcomingLoading(false);
          });

        setCollaborationsLoading(true);
        fetch(`${base}/people/${resolvedParams.id}/collaborations`, {
          signal: controller.signal,
        })
          .then(async (collabRes) => (collabRes.ok ? collabRes.json() : []))
          .then((collabData) => {
            if (!controller.signal.aborted) {
              setCollaborations(Array.isArray(collabData) ? collabData : []);
            }
          })
          .catch((sectionError) => {
            if (!controller.signal.aborted) {
              console.error("Error fetching collaborations:", sectionError);
              setCollaborations([]);
            }
          })
          .finally(() => {
            if (!controller.signal.aborted) setCollaborationsLoading(false);
          });
      } catch (fetchError) {
        if (controller.signal.aborted) return;
        console.error("Error fetching celebrity:", fetchError);
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Something went wrong while loading this profile.",
        );
        setPerson(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchPerson();

    return () => controller.abort();
  }, [resolvedParams.id, retry]);

  const credits = useMemo(() => {
    const unique = new Map<string, Credit>();
    for (const credit of person?.combined_credits?.cast || [])
      if (["movie", "tv"].includes(credit.media_type))
        unique.set(`${credit.media_type}-${credit.id}`, credit);
    return [...unique.values()];
  }, [person]);
  const movieCount = credits.filter(
    (credit) => credit.media_type === "movie",
  ).length;
  const seriesCount = credits.length - movieCount;
  const notable = useMemo(
    () =>
      [...credits]
        .filter(
          (credit) =>
            getDate(credit) && new Date(getDate(credit)) <= new Date(),
        )
        .sort(
          (a, b) =>
            (b.popularity || 0) - (a.popularity || 0) ||
            (b.vote_average || 0) - (a.vote_average || 0),
        )
        .slice(0, 6),
    [credits],
  );
  const filtered = useMemo(
    () =>
      credits
        .filter(
          (credit) =>
            (selectedTab === "all" ||
              credit.media_type ===
                (selectedTab === "movies" ? "movie" : "tv")) &&
            getTitle(credit)
              .toLocaleLowerCase()
              .includes(query.trim().toLocaleLowerCase()),
        )
        .sort((a, b) => {
          if (sortMode === "rating")
            return (b.vote_average || 0) - (a.vote_average || 0);
          if (sortMode === "latest")
            return getDate(b).localeCompare(getDate(a));
          if (sortMode === "oldest")
            return (getDate(a) || "9999").localeCompare(getDate(b) || "9999");
          return (
            (b.popularity || 0) - (a.popularity || 0) ||
            (b.vote_average || 0) - (a.vote_average || 0)
          );
        }),
    [credits, selectedTab, query, sortMode],
  );
  const topGenres = useMemo(() => {
    const counts = new Map<number, number>();
    credits.forEach((credit) =>
      credit.genre_ids?.forEach((id) =>
        counts.set(id, (counts.get(id) || 0) + 1),
      ),
    );
    return [...counts]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => genreMap[id])
      .filter(Boolean);
  }, [credits]);

  async function toggleWatchlist(credit: Credit) {
    if (!ready) {
      router.push("/auth/login");
      return;
    }
    const type = credit.media_type === "tv" ? "series" : "movie";
    const key = `${type}-${credit.id}`;
    if (loadingStates[key]) return;
    setLoadingStates((previous) => ({ ...previous, [key]: true }));
    const metadata = {
      title: getTitle(credit),
      posterUrl: tmdbImage(credit.poster_path, "w154"),
    };
    try {
      if (isInWatchlist(String(credit.id), type))
        await remove(String(credit.id), type, metadata);
      else await add(String(credit.id), type, metadata);
    } catch {
      /* The watchlist hook owns rollback and error messaging. */
    } finally {
      setLoadingStates((previous) => ({ ...previous, [key]: false }));
    }
  }
  function card(credit: Credit) {
    const type = credit.media_type === "tv" ? "series" : "movie";
    return (
      <CreditCard
        key={`${credit.media_type}-${credit.id}`}
        credit={credit}
        onSave={toggleWatchlist}
        saved={isInWatchlist(String(credit.id), type)}
        busy={loadingStates[`${type}-${credit.id}`]}
      />
    );
  }

  if (loading) return <AppLoading />;
  if (!person)
    return (
      <div className="ui-shell py-20 text-[var(--ink)]">
        <h1 className="text-3xl font-bold">Profile unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
          {error || "We couldn’t find this celebrity profile."}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            className="ui-primary-action"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </button>
          <Link href="/celeb" className="ui-secondary-action">
            Browse celebrities
          </Link>
        </div>
      </div>
    );
  const biography = person.biography?.trim();
  const lead = biography?.split(/(?<=[.!?])\s+/)[0];
  const aliases = [...new Set(person.also_known_as || [])].filter(
    (name) => name !== person.name,
  );
  const sectionClass =
    "mt-10 scroll-mt-24 border-t border-[var(--surface-border)] pt-8 sm:mt-12 sm:pt-10";

  return (
    <div className="min-h-screen bg-[var(--surface-0)] text-[var(--ink)]">
      <div className="ui-shell pb-12 pt-6 sm:pb-16 sm:pt-8 lg:pt-24">
        <Link
          href="/celeb"
          className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Celebrities
        </Link>
        <header className="grid grid-cols-[104px_minmax(0,1fr)] items-start gap-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
          <CelebrityPortrait
            key={person.id}
            person={person}
            extraPhotos={extraPhotos}
          />
          <div className="min-w-0 self-center">
            <p className="text-xs font-semibold text-[var(--ink-muted)]">
              {person.known_for_department || "Entertainment"}
            </p>
            <h1 className="mt-2 line-clamp-2 break-words text-4xl font-bold leading-none sm:text-5xl">
              {person.name}
            </h1>
            {aliases[0] && (
              <p className="mt-2 line-clamp-2 break-words text-sm text-[var(--ink-muted)]">
                {aliases[0]}
              </p>
            )}
            <p className="mt-4 text-sm leading-6 text-[var(--ink-muted)]">
              {movieCount > 0 &&
                `${movieCount} ${movieCount === 1 ? "movie" : "movies"}`}
              {movieCount > 0 && seriesCount > 0 && " · "}
              {seriesCount > 0 && `${seriesCount} series`}
              {!credits.length && "Credits will appear when available."}
            </p>
            {lead && (
              <p className="mt-4 hidden max-w-2xl text-sm leading-6 text-[var(--ink-muted)] sm:block">
                {lead}
              </p>
            )}
            <ExternalLinks person={person} />
          </div>
        </header>
        <nav
          aria-label="Celebrity page sections"
          className="mobile-native-scroll mt-6 flex gap-5 overflow-x-auto border-b border-[var(--surface-border)] pb-1 sm:mt-8 sm:gap-7"
        >
          {[
            { href: "#about", label: "About" },
            { href: "#known-for", label: "Known for" },
            { href: "#filmography", label: "Filmography" },
            { href: "#on-screen-moments", label: "Videos" },
            { href: "#gallery", label: "Photos" },
            { href: "#related", label: "Related" },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <section
          id="about"
          aria-labelledby="about-heading"
          className="scroll-mt-24 pt-8 sm:pt-10"
        >
          <SectionHeading id="about-heading" title={`About ${person.name}`} />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-12">
            <div className="min-w-0">
              <p
                id="celebrity-biography"
                className={`whitespace-pre-line text-sm leading-7 text-[var(--ink-muted)] ${!bioExpanded && (biography?.length || 0) > 350 ? "line-clamp-5" : ""}`}
              >
                {biography ||
                  "A biography isn’t available yet. Explore their credits and connected profiles below."}
              </p>
              {biography && biography.length > 350 && (
                <button
                  type="button"
                  aria-expanded={bioExpanded}
                  aria-controls="celebrity-biography"
                  onClick={() => setBioExpanded((value) => !value)}
                  className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--brand-coral-strong)]"
                >
                  {bioExpanded ? "Read less" : "Read full biography"}
                </button>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm leading-6 lg:grid-cols-1">
              {person.birthday && (
                <div>
                  <dt className="text-[var(--ink-muted)]">Born</dt>
                  <dd>{formatDate(person.birthday)}</dd>
                </div>
              )}
              {person.place_of_birth && (
                <div>
                  <dt className="text-[var(--ink-muted)]">Birthplace</dt>
                  <dd>{person.place_of_birth}</dd>
                </div>
              )}
              {person.deathday && (
                <div>
                  <dt className="text-[var(--ink-muted)]">Died</dt>
                  <dd>{formatDate(person.deathday)}</dd>
                </div>
              )}
              {topGenres.length > 0 && (
                <div className="col-span-2 lg:col-span-1">
                  <dt className="text-[var(--ink-muted)]">
                    Genres in their work
                  </dt>
                  <dd>{topGenres.join(" · ")}</dd>
                </div>
              )}
              {aliases.length > 1 && (
                <div className="col-span-2 lg:col-span-1">
                  <dt className="text-[var(--ink-muted)]">Also known as</dt>
                  <dd className="break-words">
                    {aliases.slice(0, 5).join(" · ")}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </section>
        <section
          id="known-for"
          aria-labelledby="known-for-heading"
          className={sectionClass}
        >
          <SectionHeading id="known-for-heading" title="Known for">
            <a
              href="#filmography"
              className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]"
            >
              All credits
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </SectionHeading>
          {notable.length ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-6">
              {notable.map(card)}
            </div>
          ) : (
            <p className="text-sm leading-6 text-[var(--ink-muted)]">
              Explore the filmography for available credits.
            </p>
          )}
        </section>
        <section
          id="filmography"
          aria-labelledby="filmography-heading"
          className={sectionClass}
        >
          <SectionHeading id="filmography-heading" title="Filmography">
            <p className="text-sm text-[var(--ink-muted)]">
              {credits.length} credits
            </p>
          </SectionHeading>
          <div className="mb-5 space-y-4">
            <div
              role="group"
              aria-label="Filter filmography"
              className="flex gap-5 border-b border-[var(--surface-border)]"
            >
              {(
                [
                  { value: "all", label: "All" },
                  { value: "movies", label: "Movies" },
                  { value: "tv", label: "Series" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  aria-pressed={selectedTab === tab.value}
                  onClick={() => {
                    setSelectedTab(tab.value);
                    setVisibleCount(12);
                  }}
                  className={`min-h-12 border-b-2 text-sm font-semibold ${selectedTab === tab.value ? "border-[var(--brand-coral-strong)] text-[var(--ink)]" : "border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
              <label className="relative block min-w-0 sm:w-80">
                <span className="sr-only">Search filmography</span>
                <Search
                  className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[var(--ink-muted)]"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setVisibleCount(12);
                  }}
                  placeholder="Find a title"
                  className="h-11 w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface-1)] pl-10 pr-3 text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]"
                />
              </label>
              <label className="flex min-w-0 items-center gap-3 text-sm text-[var(--ink-muted)]">
                <span className="shrink-0">Sort by</span>
                <select
                  aria-label="Sort filmography"
                  value={sortMode}
                  onChange={(event) => {
                    setSortMode(event.target.value as SortMode);
                    setVisibleCount(12);
                  }}
                  className="h-11 min-w-0 flex-1 rounded-md border border-[var(--surface-border)] bg-[var(--surface-1)] px-3 text-sm text-[var(--ink)] sm:flex-none"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          {filtered.length ? (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-4 lg:grid-cols-6">
                {filtered.slice(0, visibleCount).map(card)}
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <p role="status" className="text-xs text-[var(--ink-muted)]">
                  Showing {Math.min(visibleCount, filtered.length)} of{" "}
                  {filtered.length} credits
                </p>
                {visibleCount < filtered.length && (
                  <button
                    type="button"
                    className="ui-secondary-action"
                    onClick={() => setVisibleCount((value) => value + 12)}
                  >
                    Show more credits
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="py-6">
              <p className="text-sm text-[var(--ink-muted)]">
                No credits match this search.
              </p>
              <button
                type="button"
                className="ui-secondary-action mt-3"
                onClick={() => {
                  setQuery("");
                  setSelectedTab("all");
                  setVisibleCount(12);
                }}
              >
                Reset filters
              </button>
            </div>
          )}
        </section>
        <CelebrityMediaSections
          key={person.id}
          person={person}
          onPhotosReady={onPhotosReady}
        />
        {(upcomingLoading || upcomingProjects.length > 0) && (
          <section aria-labelledby="upcoming-heading" className={sectionClass}>
            <SectionHeading id="upcoming-heading" title="Upcoming projects" />
            {upcomingLoading ? (
              <p role="status" className="text-sm text-[var(--ink-muted)]">
                Loading upcoming projects…
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-6">
                {upcomingProjects.slice(0, 6).map(card)}
              </div>
            )}
          </section>
        )}
        {(collaborationsLoading || collaborations.length > 0) && (
          <section
            aria-labelledby="collaborators-heading"
            className={sectionClass}
          >
            <SectionHeading
              id="collaborators-heading"
              title="Frequent collaborators"
            />
            {collaborationsLoading ? (
              <p role="status" className="text-sm text-[var(--ink-muted)]">
                Loading collaborators…
              </p>
            ) : (
              <ul className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
                {collaborations.slice(0, 4).map((collaborator) => (
                  <li key={collaborator.id}>
                    <Link
                      href={`/celeb/${collaborator.id}`}
                      className="group flex items-center gap-3"
                    >
                      <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-md bg-[var(--surface-2)]">
                        <Image
                          src={
                            tmdbImage(collaborator.profile_path, "w185") ||
                            "/placeholder-person.svg"
                          }
                          alt={collaborator.name}
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="line-clamp-2 text-sm font-semibold leading-5 group-hover:text-[var(--brand-coral-strong)]">
                          {collaborator.name}
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
                          {collaborator.count} shared{" "}
                          {collaborator.count === 1 ? "credit" : "credits"}
                        </p>
                        {collaborator.projects?.[0] && (
                          <p className="line-clamp-1 text-xs leading-5 text-[var(--ink-muted)]">
                            {collaborator.projects[0]}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        {similarLoading ? (
          <section
            id="related"
            aria-labelledby="related-heading"
            className={sectionClass}
          >
            <SectionHeading id="related-heading" title="You may also like" />
            <p role="status" className="text-sm text-[var(--ink-muted)]">
              Finding connected profiles…
            </p>
          </section>
        ) : similarPeople.length ? (
          <PeopleRail key={person.id} people={similarPeople.slice(0, 18)} />
        ) : (
          <section
            id="related"
            aria-labelledby="related-heading"
            className={sectionClass}
          >
            <SectionHeading id="related-heading" title="You may also like" />
            <p className="text-sm leading-6 text-[var(--ink-muted)]">
              No connected profiles are available yet.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
