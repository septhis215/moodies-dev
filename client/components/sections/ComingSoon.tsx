import { Calendar, ChevronDown, Star } from "lucide-react";
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
    type: "movie" | "tv";
}) {
    function groupByMonthAndWeek(items: any[], type: "movie" | "tv") {
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
        <section className="mt-16">
            <div className="flex items-center gap-3 mb-6">
                <Calendar className="w-7 h-7 text-purple-500" />
                <h2 className="text-2xl sm:text-3xl font-black">{title}</h2>
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
                            className="border border-white/10 rounded-xl bg-white/5 overflow-hidden"
                        >
                            {/* Month Header */}
                            <button
                                onClick={() =>
                                    setOpenMonth(openMonth === monthYear ? null : monthYear)
                                }
                                className="w-full flex items-center justify-between px-5 py-4 bg-gradient-to-r from-purple-600/60 to-pink-500/40 hover:from-purple-600/70 hover:to-pink-500/50 transition-colors"
                            >
                                <h3 className="text-lg sm:text-xl font-black text-purple-100">
                                    {monthYear}
                                </h3>
                                <ChevronDown
                                    className={`w-5 h-5 text-purple-200 transition-transform ${openMonth === monthYear ? "rotate-180" : ""
                                        }`}
                                />
                            </button>

                            {/* Content */}
                            {openMonth === monthYear && (
                                <div className="p-5 space-y-8">
                                    {Object.entries(weeks).map(([range, weekItems], index) => (
                                        <div key={range} className="space-y-4">
                                            {/* Week Label */}
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-lg text-sm font-semibold text-purple-300">
                                                    Week {index + 1} ({range})
                                                </div>
                                                <div className="flex-1 h-px bg-white/10" />
                                            </div>

                                            {/* Grid */}
                                            <div className="grid gap-4 sm:grid-cols-4 lg:grid-cols-5">
                                                {weekItems.map((item) => {
                                                    const releaseDate = new Date(
                                                        item.release_date
                                                    );
                                                    return (
                                                        <Link
                                                            key={item.id}
                                                            href={`/${type}/${item.id}`}
                                                        >
                                                            <div className="group relative rounded-xl border border-white/10 bg-white/5 hover:border-purple-500/40 hover:bg-white/[0.07] hover:shadow-lg hover:shadow-purple-500/10 transition-all overflow-hidden">
                                                                <div className="relative w-full h-64">
                                                                    {item.poster_path && (
                                                                        <Image
                                                                            src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                                                                            alt={item.title || item.name || ""}
                                                                            fill
                                                                            className="object-cover group-hover:scale-110 transition-transform duration-500"
                                                                        />
                                                                    )}
                                                                    <div className="absolute top-2 left-2 bg-black/70 px-2 py-1 rounded-lg text-xs font-semibold text-purple-300">
                                                                        {releaseDate.toLocaleDateString("en-US", {
                                                                            month: "short",
                                                                            day: "numeric",
                                                                        })}
                                                                    </div>
                                                                </div>

                                                                <div className="p-4 flex flex-col gap-2">
                                                                    <h4 className="text-base font-bold group-hover:text-purple-400 transition-colors line-clamp-1">
                                                                        {item.title || item.name}
                                                                    </h4>
                                                                    <div className="flex items-center gap-3 text-sm">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                                                                            <span className="font-bold">
                                                                                {item.vote_average?.toFixed(1)}
                                                                            </span>
                                                                        </div>
                                                                        <button
                                                                            onClick={(e) => e.preventDefault()}
                                                                            className="ml-auto px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-lg font-semibold text-purple-300 hover:bg-purple-500/30 transition-colors text-xs"
                                                                        >
                                                                            Remind Me
                                                                        </button>
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
