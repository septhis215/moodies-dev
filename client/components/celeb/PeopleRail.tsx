"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { tmdbImage } from "@/lib/tmdb";

type RelatedPerson = {
  id: number;
  name: string;
  profile_path?: string | null;
  relationship?: string;
  known_for_department?: string;
};

export default function PeopleRail({ people }: { people: RelatedPerson[] }) {
  const rail = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ previous: false, next: false });

  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    const update = () => {
      const maximum = Math.max(0, element.scrollWidth - element.clientWidth);
      setEdges({
        previous: element.scrollLeft > 2,
        next: maximum - element.scrollLeft > 2,
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (track.current) observer.observe(track.current);
    element.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", update);
    };
  }, [people]);

  function move(direction: number) {
    const element = rail.current;
    if (!element) return;
    element.scrollBy({
      left: direction * element.clientWidth * 0.85,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }

  return (
    <section
      id="related"
      aria-labelledby="related-heading"
      className="mt-10 min-w-0 scroll-mt-24 border-t border-[var(--surface-border)] pt-8 sm:mt-12 sm:pt-10"
    >
      <header className="mb-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2
            id="related-heading"
            className="text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl"
          >
            You may also like
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
            Connected through groups and shared projects.
          </p>
        </div>
        <div
          className="flex shrink-0 gap-2"
          role="group"
          aria-label="Browse related celebrities"
        >
          {[
            {
              direction: -1,
              label: "Previous related celebrities",
              enabled: edges.previous,
              Icon: ChevronLeft,
            },
            {
              direction: 1,
              label: "Next related celebrities",
              enabled: edges.next,
              Icon: ChevronRight,
            },
          ].map(({ direction, label, enabled, Icon }) => (
            <button
              key={direction}
              type="button"
              aria-label={label}
              aria-controls="related-people-rail"
              disabled={!enabled}
              onClick={() => move(direction)}
              className="grid h-11 w-11 place-items-center rounded-full border border-[var(--surface-border)] text-[var(--ink)] transition-colors enabled:hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral-strong)] disabled:cursor-default disabled:opacity-30"
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </button>
          ))}
        </div>
      </header>
      <div
        ref={rail}
        id="related-people-rail"
        tabIndex={0}
        aria-label="Related celebrity profiles"
        className="mobile-native-scroll min-w-0 snap-x snap-mandatory overflow-x-auto pb-3 focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]"
      >
        <ul ref={track} className="flex w-max min-w-full gap-4 sm:gap-5">
          {people.map((person) => (
            <li key={person.id} className="w-32 shrink-0 snap-start sm:w-40">
              <Link href={`/celeb/${person.id}`} className="group block">
                <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-[var(--surface-2)]">
                  <Image
                    src={
                      tmdbImage(person.profile_path, "w342") ||
                      "/placeholder-person.svg"
                    }
                    alt={person.name}
                    fill
                    sizes="(max-width: 639px) 128px, 160px"
                    className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
                  />
                </div>
                <h3 className="mt-3 line-clamp-2 text-sm font-semibold leading-5 text-[var(--ink)] group-hover:text-[var(--brand-coral-strong)]">
                  {person.name}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--ink-muted)]">
                  {person.relationship ||
                    person.known_for_department ||
                    "Entertainment"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
