// components/selected-content/extended/allCredits.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { tmdbImage } from "@/lib/tmdb";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import Link from "next/link";
import { ArrowLeft, Users2, Search } from "lucide-react";
import CustomSelect from "@/components/ui/custom-select";

type Person = {
  id: number | string;
  name: string;
  profile_path?: string;
  character?: string;
  job?: string;
  department?: string;
  order?: number;
  roles?: Array<{ character?: string | null }>;
};

type ContentInfo = {
  content_type: string;
  title: string;
};

export default function AllCredits({
  credits,
  info,
  id,
  highlight,
}: {
  credits: { cast?: Person[]; crew?: Person[] };
  info: ContentInfo;
  id?: string;
  highlight?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"cast" | "crew">("cast");
  const [sortBy, setSortBy] = useState<"order" | "name">("order");

  const cast: Person[] = (credits?.cast ?? []).slice();
  const crew: Person[] = (credits?.crew ?? []).slice();

  const castWithOrder = useMemo(
    () =>
      cast.map((p, i) => ({
        ...p,
        order: typeof p.order === "number" ? p.order : i + 1,
        character:
          p.character ??
          (Array.isArray(p.roles) && p.roles.length > 0
            ? p.roles.map((r) => r.character).filter(Boolean).join(", ")
            : undefined),
      })),
    [cast],
  );

  const castFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = castWithOrder;
    if (q)
      arr = arr.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.character ?? "").toLowerCase().includes(q),
      );
    if (sortBy === "order") arr = arr.sort((a, b) => a.order! - b.order!);
    else arr = arr.sort((a, b) => a.name.localeCompare(b.name));
    return arr;
  }, [castWithOrder, query, sortBy]);

  const crewByDepartment = useMemo(() => {
    const map = new Map<string, Person[]>();
    crew.forEach((p) => {
      const dept = p.department ?? "Other";
      if (!map.has(dept)) map.set(dept, []);
      map.get(dept)!.push(p);
    });
    const groups = Array.from(map.entries()).map(([dept, people]) => ({
      dept,
      people: people.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
    }));
    groups.sort((a, b) => a.dept.localeCompare(b.dept));
    return groups;
  }, [crew]);

  const departmentAnchors = crewByDepartment.map((g) => g.dept);

  useEffect(() => {
    if (!highlight) return;
    setTimeout(() => {
      const el = document.getElementById(`credit-${highlight}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.style.transition = "box-shadow 0.3s ease";
        el.style.boxShadow = "0 0 0 2px rgba(233,79,55,0.5)";
        setTimeout(() => (el.style.boxShadow = ""), 2200);
      }
    }, 120);
  }, [highlight, castFiltered.length, crewByDepartment.length]);

  function imageSrc(path?: string) {
    if (!path) return null;
    if (path.startsWith("/http") || path.startsWith("/https"))
      return path.slice(1);
    return tmdbImage(path, "w185");
  }

  function contentType(type: string) {
    return type === "movie" ? "movies" : "tv";
  }

  return (
    <div className="min-h-screen bg-black text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:space-y-8 sm:px-6 sm:py-10">
        {/* ── Back nav ── */}
        <Link
          href={`/${contentType(info.content_type)}/${id}`}
          className="group inline-flex min-h-11 items-center gap-2 text-sm text-white/50 transition-colors hover:text-white"
        >
          <ArrowLeft
            size={16}
            className="group-hover:-translate-x-0.5 transition-transform"
          />
          Back to {info.title}
        </Link>

        {/* ── Page header ── */}
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
              Full Cast & Crew
            </h1>
            <p className="text-sm text-white/40 mt-1">{info.title}</p>
          </div>

          {/* Controls cluster */}
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {/* Tab toggle */}
            <div className="flex min-h-11 items-center gap-1 rounded-lg border border-white/[0.07] bg-white/[0.04] p-1">
              {(["cast", "crew"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`min-h-9 rounded-md px-4 py-1.5 text-xs font-semibold capitalize transition-all duration-200 cursor-pointer ${
                    tab === t
                      ? "bg-[#e94f37] text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="hidden sm:block h-5 w-px bg-white/[0.1]" />

            {/* Search */}
            <div className="relative min-w-[min(100%,14rem)] flex-1 sm:flex-none">
              <Search
                size={12}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or role…"
                className="min-h-11 w-full rounded-lg border border-white/[0.07] bg-white/[0.05] py-2 pl-8 pr-3 text-xs text-white outline-none transition-colors placeholder-white/25 focus:border-[#e94f37]/40 sm:w-56"
              />
            </div>

            {/* Sort (cast only) */}
            {tab === "cast" && (
              <CustomSelect
                value={sortBy}
                onChange={(v) => setSortBy(v as "order" | "name")}
                options={[
                  { label: "Billing order", value: "order" },
                  { label: "Name A–Z", value: "name" },
                ]}
                widthClass="w-36"
              />
            )}
          </div>
        </div>

        {/* ── Count + dept jump ── */}
        <div className="flex items-center justify-between gap-4">
          <p className="text-[11px] text-white/25">
            {tab === "cast"
              ? `${castFiltered.length} member${castFiltered.length !== 1 ? "s" : ""}`
              : `${crew.length} crew entr${crew.length !== 1 ? "ies" : "y"}`}
          </p>

          {tab === "crew" && departmentAnchors.length > 0 && (
            <div className="hidden items-center gap-2 overflow-x-auto mobile-native-scroll scrollbar-none sm:flex">
              <span className="text-[11px] text-white/25 flex-shrink-0">
                Jump:
              </span>
              {departmentAnchors.map((d) => (
                <a
                  key={d}
                  href={`#dept-${encodeURIComponent(d)}`}
                  className="text-[11px] px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.07] hover:bg-white/[0.08] hover:text-white text-white/40 transition-all whitespace-nowrap flex-shrink-0"
                >
                  {d.length > 14 ? d.slice(0, 14) + "…" : d}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* ── Red rule ── */}
        <div className="h-px bg-white/[0.06]" />

        {/* ── CAST TAB ── */}
        {tab === "cast" && (
          <section>
            {castFiltered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <Users2 size={28} className="text-white/20" />
                <p className="text-sm text-white/30">No cast found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {castFiltered.map((p) => (
                  <article
                    id={`credit-${p.id}`}
                    key={`cast-${p.id}`}
                    className="group flex gap-4 p-3 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200"
                  >
                    {/* Photo */}
                    <div className="w-16 h-20 sm:w-20 sm:h-28 rounded-lg overflow-hidden bg-white/[0.06] flex-shrink-0">
                      <Image
                        src={imageSrc(p.profile_path) ?? "/placeholder-person.svg"}
                        alt={p.name}
                        width={80}
                        height={112}
                        style={{
                          objectFit: "cover",
                          width: "100%",
                          height: "100%",
                        }}
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                      <div>
                        <p className="text-sm font-semibold text-white leading-snug truncate">
                          {p.name}
                        </p>
                        <p className="text-[11px] text-white/35 mt-0.5 leading-snug line-clamp-2 italic">
                          {p.character ?? "—"}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[11px] text-white/20">
                          #{p.order! + 1}
                        </span>
                        <Link
                          href={`/celeb/${p.id}`}
                          className="text-[11px] text-[#e94f37] hover:text-[#ff6b58] font-medium transition-colors"
                        >
                          Profile →
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── CREW TAB ── */}
        {tab === "crew" && (
          <section className="space-y-10">
            {crewByDepartment.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <Users2 size={28} className="text-white/20" />
                <p className="text-sm text-white/30">No crew found.</p>
              </div>
            ) : (
              crewByDepartment.map((group) => (
                <div
                  key={group.dept}
                  id={`dept-${encodeURIComponent(group.dept)}`}
                >
                  {/* Department heading */}
                  <div className="flex items-center gap-3 mb-4">
                    <p className="text-[11px] uppercase tracking-widest text-white/30 font-semibold">
                      {group.dept}
                    </p>
                    <div className="flex-1 h-px bg-white/[0.06]" />
                    <span className="text-[11px] text-white/20">
                      {group.people.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {group.people.map((person) => (
                      <div
                        id={`credit-${person.id}`}
                        key={`${group.dept}-${person.id}`}
                        className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.1] transition-all duration-150"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {person.name}
                          </p>
                          <p className="text-[11px] text-white/35 truncate">
                            {person.job ?? ""}
                          </p>
                        </div>
                        <Link
                          href={`/celeb/${person.id}`}
                          className="text-[11px] text-[#e94f37] hover:text-[#ff6b58] font-medium transition-colors flex-shrink-0"
                        >
                          Profile →
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>
        )}
      </div>
    </div>
  );
}
