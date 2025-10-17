// components/selected-content/extended/allCredits.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Users2, ChevronDown } from "lucide-react";
import CustomSelect from "@/components/ui/custom-select";

type Person = {
  id: number | string;
  name: string;
  profile_path?: string;
  character?: string; // for cast
  job?: string; // for crew
  department?: string;
  order?: number; // billing order
};

export default function AllCredits({
  credits,
  info,
  id,
  highlight,
}: {
  credits: { cast?: Person[]; crew?: Person[] };
  info?: any;
  id?: string;
  highlight?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"cast" | "crew">("cast");
  const [sortBy, setSortBy] = useState<"order" | "name">("order");

  const cast: Person[] = (credits?.cast ?? []).slice();
  const crew: Person[] = (credits?.crew ?? []).slice();

  // normalize order for cast (if provided) - fallback to index
  const castWithOrder = useMemo(
    () =>
      cast.map((p, i) => ({
        ...p,
        order: typeof p.order === "number" ? p.order : i + 1,
        // 🔧 Fix: Normalize TV "roles" array into character string
        character:
          p.character ??
          (Array.isArray((p as any).roles) && (p as any).roles.length > 0
            ? (p as any).roles.map((r: any) => r.character).join(", ")
            : undefined),
      })),
    [cast]
  );

  // combined search helpers
  const castFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = castWithOrder;
    if (q) {
      arr = arr.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.character ?? "").toLowerCase().includes(q)
      );
    }
    if (sortBy === "order") arr = arr.sort((a, b) => a.order! - b.order!);
    else arr = arr.sort((a, b) => a.name.localeCompare(b.name));
    return arr;
  }, [castWithOrder, query, sortBy]);

  // group crew by department and sort each group by name
  const crewByDepartment = useMemo(() => {
    const map = new Map<string, Person[]>();
    crew.forEach((p) => {
      const dept = p.department ?? "Other";
      if (!map.has(dept)) map.set(dept, []);
      map.get(dept)!.push(p);
    });
    // sort groups by dept name
    const groups = Array.from(map.entries()).map(([dept, people]) => ({
      dept,
      people: people.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
    }));
    groups.sort((a, b) => a.dept.localeCompare(b.dept));
    return groups;
  }, [crew]);

  // allow quick-jump links for crew departments (useful on large pages)
  const departmentAnchors = crewByDepartment.map((g) => g.dept);

  // scroll-to-highlight behavior (works for cast and crew IDs)
  useEffect(() => {
    if (!highlight) return;
    setTimeout(() => {
      const el = document.getElementById(`credit-${highlight}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.style.transition = "box-shadow 0.3s ease";
        el.style.boxShadow = "0 0 0 4px rgba(99,102,241,0.35)";
        setTimeout(() => (el.style.boxShadow = ""), 2200);
      }
    }, 120);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight, castFiltered.length, crewByDepartment.length]);

  // util to get image src handling TMDB / gravatar style leading '/http'
  function imageSrc(path?: string) {
    if (!path) return null;
    if (path.startsWith("/http") || path.startsWith("/https"))
      return path.slice(1);
    return `https://image.tmdb.org/t/p/w185${path}`;
  }

  const contentType = (type: string) => {
    if (type === "movie") return "movies";
    else return "tv";
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 max-w-6xl mx-auto px-6 py-12">
      {/* Back Navigation */}
      <Link
        href={`/${contentType(info.content_type)}/${id}`}
        className="inline-flex items-center gap-2 text-slate-300 hover:text-white transition-colors mb-8"
      >
        <ArrowLeft size={20} />
        Back to {info.title}
      </Link>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Full Cast & Crew</h1>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Tabs */}
          <div className="flex items-center bg-white/5 rounded p-1">
            <button
              onClick={() => setTab("cast")}
              className={`px-3 py-1 rounded text-sm font-medium cursor-pointer ${
                tab === "cast"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow"
                  : "text-slate-200"
              }`}
            >
              Cast
            </button>
            <button
              onClick={() => setTab("crew")}
              className={`px-3 py-1 rounded text-sm font-medium cursor-pointer ${
                tab === "crew"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow"
                  : "text-slate-200"
              }`}
            >
              Crew
            </button>
          </div>

          {/* Search */}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people or role..."
            className="ml-2 bg-slate-800/60 text-slate-100 placeholder-slate-400 rounded px-3 py-2 border border-white/8 w-full sm:w-64"
          />
        </div>
      </div>

      {/* Controls (sort only shows for cast tab) */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="text-xs text-slate-400">
          {tab === "cast"
            ? `${castFiltered.length} cast member(s)`
            : `${
                crew.reduce((acc, g) => acc + 1 * (g ? 1 : 0), 0) + crew.length
              } crew entries`}
        </div>

        <div className="flex items-center gap-3">
          {tab === "cast" && (
            <CustomSelect
              value={sortBy}
              onChange={(v: any) => setSortBy(v)}
              options={[
                { label: "Sort: Billing order", value: "order" },
                { label: "Sort: Name", value: "name" },
              ]}
              widthClass="w-52"
            />
          )}

          {tab === "crew" && departmentAnchors.length > 0 && (
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs text-slate-400">Jump to:</span>
              <div className="flex gap-2 overflow-x-auto scrollbar-none">
                {departmentAnchors.map((d) => (
                  <a
                    key={d}
                    href={`#dept-${encodeURIComponent(d)}`}
                    className="text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/6"
                  >
                    {d.length > 12 ? d.slice(0, 12) + "…" : d}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div>
        {/* CAST TAB */}
        {tab === "cast" && (
          <section>
            {/* IMDB-like top: big grid with images and role */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {castFiltered.length === 0 ? (
                <div className="text-slate-400">No cast found.</div>
              ) : (
                castFiltered.map((p) => (
                  <article
                    id={`credit-${p.id}`}
                    key={`cast-${p.id}`}
                    className="flex gap-4 p-3 rounded-lg bg-gradient-to-br from-slate-900/70 to-slate-800/60 border border-white/8"
                  >
                    {/* Image only for cast (IMDB style) */}
                    <div className="w-28 h-36 rounded overflow-hidden bg-slate-700/30 flex-shrink-0">
                      {imageSrc(p.profile_path) ? (
                        <Image
                          src={imageSrc(p.profile_path)!}
                          alt={p.name}
                          width={112}
                          height={144}
                          style={{ objectFit: "cover" }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <Users2 size={28} />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 max-w-[160px] sm:max-w-full whitespace-normal break-words">
                          <h3 className="text-sm font-semibold text-slate-100 leading-snug">
                            {p.name}
                          </h3>
                          <div className="text-xs text-slate-400 mt-1 italic leading-tight">
                            {p.character ?? "—"}
                          </div>
                        </div>

                        <div className="text-xs text-slate-400 text-right">
                          <div>#{p.order + 1}</div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-3">
                        <Link
                          href={`/celeb/${p.id}`}
                          className="text-xs text-indigo-400 hover:underline"
                        >
                          View profile
                        </Link>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        )}

        {/* CREW TAB */}
        {tab === "crew" && (
          <section className="space-y-8">
            {crewByDepartment.length === 0 ? (
              <div className="text-slate-400">No crew found.</div>
            ) : (
              crewByDepartment.map((group) => (
                <div
                  key={group.dept}
                  id={`dept-${encodeURIComponent(group.dept)}`}
                >
                  <h3 className="text-sm font-semibold text-slate-100 mb-3">
                    {group.dept}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {group.people.map((person) => (
                      <div
                        id={`credit-${person.id}`}
                        key={`${group.dept}-${person.id}`}
                        className="flex items-center justify-between gap-4 p-3 rounded bg-gradient-to-br from-slate-900/70 to-slate-800/55 border border-white/6"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-100 truncate">
                            {person.name}
                          </div>
                          <div className="text-xs text-slate-400 truncate">
                            {person.job ?? ""}
                          </div>
                        </div>

                        <div className="flex-shrink-0 ml-2">
                          <Link
                            href={`/celeb/${person.id}`}
                            className="text-xs text-indigo-400 hover:underline"
                          >
                            Profile
                          </Link>
                        </div>
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
