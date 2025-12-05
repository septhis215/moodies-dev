import { Calendar, ChevronDown, Info, Plus, Share2, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React from "react";

export function ComingSoonSection({
    title,
    items,
    type,
}: {
    title: string;
    items: any[];
    type: "movies" | "tv";
}) {
    function groupByMonthAndWeek(items: any[], type: "movies" | "tv") {
        const grouped: Record<string, any[]> = {};

        items.forEach((item) => {
            const rawDate = item.release_date;
            if (!rawDate) return;

            const date = new Date(rawDate);
            const monthYear = date.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
            });

            if (!grouped[monthYear]) grouped[monthYear] = [];
            grouped[monthYear].push({ ...item, _parsedDate: date });
        });

        return grouped;
    }

    // Reuse your week grouping helper
    function groupByWeek(movies: any[]) {
        const weeks: Record<string, any[]> = {};
        movies.forEach((movie) => {
            const date = movie._parsedDate || new Date(movie.release_date || movie.first_air_date);
            const start = new Date(date);
            start.setDate(date.getDate() - date.getDay()); // start of week
            const end = new Date(start);
            end.setDate(start.getDate() + 6);

            const range = `${start.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
            })} - ${end.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
            })}`;

            if (!weeks[range]) weeks[range] = [];
            weeks[range].push(movie);
        });
        return weeks;
    }

    const [openMonth, setOpenMonth] = React.useState<string | null>(null);

    const grouped = groupByMonthAndWeek(items, type);

    return (
        <section id="upcoming" className="relative max-w-7xl w-full mx-auto py-22 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-6">
                <Calendar className="w-7 h-7 text-[#e94f37]" />
                <h2 className="text-2xl sm:text-3xl font-black text-white">{title}</h2>
            </div>

            <div className="space-y-8">
                {Object.entries(grouped).map(([monthYear, groupedItems]) => {
                    const sorted = groupedItems.sort(
                        (a, b) => a._parsedDate.getTime() - b._parsedDate.getTime()
                    );
                    const weeks = groupByWeek(sorted);

                    return (
                        <div
                            key={monthYear}
                            className="border border-white/10 rounded-xl bg-neutral-900 overflow-hidden shadow-md"
                        >
                            {/* Month Header */}
                            <button
                                onClick={() =>
                                    setOpenMonth(openMonth === monthYear ? null : monthYear)
                                }
                                className="w-full flex items-center justify-between px-5 py-4 
                         bg-gradient-to-r from-[#e94f37]/90 to-[#00bfa6]/80
                         hover:from-[#e94f37] hover:to-[#00bfa6] transition-colors"
                            >
                                <h3 className="text-lg sm:text-xl font-black text-white">
                                    {monthYear}
                                </h3>
                                <ChevronDown
                                    className={`w-5 h-5 text-white transition-transform ${openMonth === monthYear ? "rotate-180" : ""
                                        }`}
                                />
                            </button>

                            {/* Content */}
                            {openMonth === monthYear && (
                                <div className="p-6 space-y-10">
                                    {Object.entries(weeks).map(([range, weekItems], index) => (
                                        <div key={range} className="space-y-5">
                                            {/* Week Label */}
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="px-3 py-1 bg-[#e94f37]/20 border border-[#e94f37]/40 rounded-lg text-sm font-semibold text-white">
                                                    Week {index + 1} ({range})
                                                </div>
                                                <div className="flex-1 h-px bg-[#00bfa6]/30" />
                                            </div>

                                            {/* Grid */}
                                            <div className="grid gap-6 sm:grid-cols-4 lg:grid-cols-5">
                                                {weekItems.map((item) => {
                                                    const releaseDate = new Date(item.release_date);
                                                    return (
                                                        <Link key={item.id} href={`/${type}/${item.id}`}>
                                                            <div className="group relative rounded-xl border border-white/10 bg-neutral-900 hover:border-[#e94f37]/50 hover:shadow-lg hover:shadow-[#e94f37]/20 transition-all overflow-hidden">

                                                                {/* Poster with Gradient Overlay */}
                                                                <div className="relative w-full h-72">
                                                                    {item.poster_path && (
                                                                        <Image
                                                                            src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                                                                            alt={item.title || item.name || ""}
                                                                            fill
                                                                            className="object-cover group-hover:scale-105 transition-transform duration-700"
                                                                        />
                                                                    )}
                                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                                                                    {/* Release Date */}
                                                                    <div className="absolute top-2 left-2 bg-black/70 px-2.5 py-1 rounded-lg text-xs font-semibold text-white/90 shadow-md">
                                                                        {new Date(item.release_date).toLocaleDateString("en-US", {
                                                                            month: "short",
                                                                            day: "numeric",
                                                                        })}
                                                                    </div>

                                                                    {/* Title at Bottom */}
                                                                    <div className="absolute bottom-3 left-3 right-3">
                                                                        <h4 className="text-base font-bold text-white group-hover:text-[#e94f37] transition-colors line-clamp-1 drop-shadow-md">
                                                                            {item.title || item.name}
                                                                        </h4>
                                                                    </div>
                                                                </div>
                                                                {/* Hover overlay */}
                                                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                                    <div className="absolute bottom-0 left-0 right-0 p-4">
                                                                        <div className="flex justify-center gap-2 mb-3">
                                                                            <button
                                                                                onClick={(e) => { e.preventDefault(); }}
                                                                                className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-xl"
                                                                                title="Add to List"
                                                                            >
                                                                                <Plus className="w-5 h-5 text-black" />
                                                                            </button>

                                                                            <button
                                                                                className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-xl"
                                                                                title="More Info"
                                                                            >
                                                                                <Info className="w-5 h-5 text-black" />
                                                                            </button>

                                                                            <button
                                                                                onClick={(e) => { e.preventDefault(); }}
                                                                                className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-xl"
                                                                                title="Share"
                                                                            >
                                                                                <Share2 className="w-5 h-5 text-black" />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>



                                                            </div>
                                                        </Link>

                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );

}
