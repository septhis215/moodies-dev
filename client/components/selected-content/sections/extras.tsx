"use client";

import Link from "next/link";
import { ArrowUpRight, ChevronDown, ChevronUp, Search, Users2 } from "lucide-react";
import { useMemo, useState } from "react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { tmdbImage } from "@/lib/tmdb";
import { selectKeyCrewGroups } from "@/components/selected-content/keyCrew";
import type {
  MovieDetailsData,
  ProviderCountry,
  TvDetailsData,
} from "@/components/selected-content/types";

type DetailsProps = {
  data: MovieDetailsData | TvDetailsData;
  contentId?: string;
};

function initials(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function ExtraDetails({ data, contentId }: DetailsProps) {
  const [providerSearch, setProviderSearch] = useState("");
  const [castLimit, setCastLimit] = useState(12);
  const { info, credits, providers } = data;
  const basePath = info.content_type === "tv" ? "tv" : "movies";
  const creditsHref = contentId ? `/${basePath}/${contentId}/credits` : "#";

  const keyCrew = useMemo(() => selectKeyCrewGroups(
    credits.crew,
    info.content_type,
    info.content_type === "tv" ? info.created_by ?? [] : [],
  ), [credits.crew, info]);

  const allProviders = useMemo(() => {
    const map = new Map<string, { provider_name: string; logo_path?: string }>();
    Object.values(providers?.results ?? {}).forEach((countryEntry) => {
      (["flatrate", "rent", "buy"] as const).forEach((key) => {
        const list = countryEntry[key as keyof ProviderCountry];
        if (!Array.isArray(list)) return;
        list.forEach((provider) => {
          const previous = map.get(provider.provider_name);
          map.set(provider.provider_name, {
            provider_name: provider.provider_name,
            logo_path: previous?.logo_path ?? provider.logo_path,
          });
        });
      });
    });
    return Array.from(map.values()).sort((a, b) =>
      a.provider_name.localeCompare(b.provider_name),
    );
  }, [providers]);

  const visibleProviders = allProviders.filter((provider) =>
    provider.provider_name
      .toLowerCase()
      .includes(providerSearch.trim().toLowerCase()),
  );
  const visibleCast = credits.cast.slice(0, castLimit);
  const mobileCast = credits.cast.slice(0, 4);
  const hasDistribution =
    info.production_countries.length > 0 || allProviders.length > 0;

  const renderCast = (people: typeof credits.cast) =>
    people.map((actor) => (
      <Link
        key={actor.id}
        href={`/celeb/${actor.id}`}
        className="group min-w-0 border-b border-[var(--surface-border)] pb-4 transition-colors hover:border-brand-coral/60"
      >
        <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-[var(--surface-1)]">
          <Image
            src={
              actor.profile_path
                ? tmdbImage(actor.profile_path, "w185")
                : "/placeholder-person.svg"
            }
            alt={actor.name}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 16vw"
            className="object-cover"
          />
        </div>
        <p className="mt-3 truncate text-sm font-semibold leading-5 text-[var(--ink)]">
          {actor.name}
        </p>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--ink-muted)]">
          {actor.character || "Cast"}
        </p>
      </Link>
    ));

  return (
    <section
      className="ui-shell scroll-mt-24 py-8 sm:py-10"
      aria-labelledby="details-heading"
    >
      <header className="max-w-2xl">
        <h2
          id="details-heading"
          className="text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl"
        >
          The making of it
        </h2>
        <p className="mt-3 text-base leading-7 text-[var(--ink-muted)]">
          A useful credit trail, followed by where the title is made and where
          it may be available.
        </p>
      </header>

      {credits.cast.length > 0 ? (
        <div className="mt-8 border-t border-[var(--surface-border)] pt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-[var(--ink)]">Cast</h3>
              <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
                The performers most closely tied to the story.
              </p>
            </div>
            {contentId && <Link href={creditsHref} className="ui-secondary-action leading-none ml-auto sm:ml-0" aria-label="View full cast and crew">
              Credits <Users2 size={16} aria-hidden="true" />
            </Link>}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5 sm:hidden">
            {renderCast(mobileCast)}
          </div>
          <div className="mt-5 hidden gap-x-4 gap-y-5 sm:grid sm:grid-cols-3 lg:grid-cols-6">
            {renderCast(visibleCast)}
          </div>

          {credits.cast.length > 12 ? (
            <div className="mt-6 hidden flex-wrap gap-2 sm:flex">
              {castLimit < credits.cast.length ? (
                <button
                  type="button"
                  onClick={() =>
                    setCastLimit((current) =>
                      Math.min(current + 12, credits.cast.length),
                    )
                  }
                  className="ui-secondary-action leading-none"
                >
                  More
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
              {castLimit > 12 ? (
                <button
                  type="button"
                  onClick={() => setCastLimit(12)}
                  className="ui-secondary-action leading-none"
                >
                  Less
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {keyCrew.length > 0 ? (
        <section className="mt-8 border-t border-[var(--surface-border)] pt-6" aria-labelledby="key-crew-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 id="key-crew-heading" className="text-xl font-bold leading-tight text-[var(--ink)] sm:text-2xl">
                Key crew
              </h3>
              <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
                The people shaping the story.
              </p>
            </div>
            {contentId && <Link href={creditsHref} className="ui-secondary-action leading-none" aria-label="View full cast and crew">
              Credits <Users2 size={16} aria-hidden="true" />
            </Link>}
          </div>
          <dl className="mt-5 divide-y divide-[var(--surface-border)]">
            {keyCrew.map((group) => (
              <div key={group.label} className="grid gap-2 py-4 first:pt-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6">
                <dt className="text-sm font-semibold leading-6 text-[var(--ink-muted)] sm:pt-2">{group.label}</dt>
                <dd className="flex min-w-0 flex-wrap gap-x-6 gap-y-1">
                  {group.people.map((person) => (
                    <Link key={person.id} href={`/celeb/${person.id}`} prefetch={false}
                      className="group inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg text-sm font-semibold leading-6 text-[var(--ink)] transition-colors hover:text-[var(--brand-coral-strong)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand-coral)]">
                      <span className="min-w-0 break-words">{person.name}</span>
                      <ArrowUpRight size={14} className="shrink-0 text-[var(--ink-muted)] group-hover:text-[var(--brand-coral-strong)]" aria-hidden="true" />
                    </Link>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {hasDistribution ? (
        <div className="mt-8 grid gap-8 border-t border-[var(--surface-border)] pt-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <h3 className="text-xl font-semibold text-[var(--ink)]">Origin</h3>
            <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
              Production countries and companies attached to the title.
            </p>
            <div className="mt-5 space-y-4">
              {info.production_countries.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold text-[var(--ink-muted)]">Production countries</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--ink)]">
                    {info.production_countries
                      .map((country) => country.name || country.iso_3166_1)
                      .join(" · ")}
                  </p>
                </div>
              ) : null}
              {info.production_companies.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold text-[var(--ink-muted)]">Production companies</p>
                  <ul className="mt-2 space-y-2 text-sm leading-6 text-[var(--ink)]">
                    {info.production_companies.map((company) => (
                      <li key={company.id}>{company.name}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-[var(--ink)]">
                  Where to watch
                </h3>
                <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
                  Availability changes by country and time.
                </p>
              </div>
              {allProviders.length > 0 ? (
                <span className="text-xs text-[var(--ink-muted)]">
                  {allProviders.length} listed
                </span>
              ) : null}
            </div>
            {allProviders.length > 0 ? (
              <>
                <label className="relative mt-5 block">
                  <span className="sr-only">Search providers</span>
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={providerSearch}
                    onChange={(event) => setProviderSearch(event.target.value)}
                    placeholder="Search providers"
                    className="h-10 w-full border-b border-[var(--surface-border)] bg-transparent pl-9 pr-3 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)] focus:border-brand-coral-strong"
                  />
                </label>
                <div className="mt-4 grid gap-x-6 sm:grid-cols-2">
                  {visibleProviders.length > 0 ? (
                    visibleProviders.map((provider) => (
                      <div
                        key={provider.provider_name}
                        className="flex items-center gap-3 border-b border-[var(--surface-border)] py-3"
                      >
                        {provider.logo_path ? (
                          <Image
                            src={tmdbImage(provider.logo_path, "w92")}
                            alt=""
                            width={28}
                            height={28}
                            className="h-7 w-7 rounded-xl object-cover"
                          />
                        ) : (
                          <span className="grid h-7 w-7 place-items-center rounded-xl bg-[var(--surface-2)] text-[10px] font-bold text-[var(--ink-muted)]">
                            {initials(provider.provider_name).slice(0, 2)}
                          </span>
                        )}
                        <span className="truncate text-sm text-[var(--ink)]">
                          {provider.provider_name}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--ink-muted)]">
                      No providers match that search.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="mt-5 text-sm leading-6 text-[var(--ink-muted)]">
                No streaming availability was returned for this title.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
