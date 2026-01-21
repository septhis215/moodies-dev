"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Film, Tv, Bookmark, Settings, LogOut, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/app/context/AuthProvider";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || "";
const TMDB_READ_TOKEN = process.env.NEXT_PUBLIC_TMDB_READ_TOKEN || "";

type Watchlist = { movieId: string[]; seriesId: string[] };
type ServerUser = {
    id?: string;
    name?: string;
    username?: string;
    email?: string;
    role?: string;
    avatarUrl?: string | null;
    reviewWarningScore?: number | null;
    reviewBannedUntil?: string | null;
};

type Kind = "movie" | "tv";
type TmdbItem = {
    id: number;
    kind: Kind;
    title?: string;
    name?: string;
    poster_path?: string | null;
    vote_average?: number;
    release_date?: string;
    first_air_date?: string;
};

export default function ProfilePage() {
    const { user: decodedUser, token, logoutSilent } = useAuth();

    const [profile, setProfile] = useState<ServerUser | null>(null);
    const [watchlist, setWatchlist] = useState<Watchlist | null>(null);
    const [tmdbItems, setTmdbItems] = useState<TmdbItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<"profile" | "watchlist" | "reviews">("profile");
    const [editOpen, setEditOpen] = useState(false);

    const user = profile ?? (decodedUser as ServerUser | null);

    /* ---------------- Fetch profile + watchlist ---------------- */
    useEffect(() => {
        if (!token) return;
        let alive = true;

        (async () => {
            setLoading(true);
            try {
                const [meRes, wlRes] = await Promise.all([
                    fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
                    fetch(`${API_BASE}/watchlist`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
                ]);

                if (!alive) return;
                if (meRes.status === 401 || wlRes.status === 401) return logoutSilent();

                if (meRes.ok) setProfile(await meRes.json());
                if (wlRes.ok) setWatchlist(await wlRes.json());
            } finally {
                if (alive) setLoading(false);
            }
        })();

        return () => { alive = false; };
    }, [token, logoutSilent]);

    /* ---------------- Fetch TMDB details ---------------- */
    const movieIds = useMemo(() => watchlist?.movieId ?? [], [watchlist]);
    const seriesIds = useMemo(() => watchlist?.seriesId ?? [], [watchlist]);

    useEffect(() => {
        let alive = true;
        const fetchTmdb = async (kind: Kind, id: string) => {
            const url = kind === "movie"
                ? `https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_API_KEY}&language=en-US`
                : `https://api.themoviedb.org/3/tv/${id}?api_key=${TMDB_API_KEY}&language=en-US`;
            const res = await fetch(url);
            if (!res.ok) return null;
            const json = await res.json();
            return { kind, ...json };
        };

        (async () => {
            const allIds = [
                ...movieIds.map((id) => ({ kind: "movie" as const, id })),
                ...seriesIds.map((id) => ({ kind: "tv" as const, id })),
            ];
            const promises = allIds.map(({ kind, id }) => fetchTmdb(kind, id));
            const results = await Promise.all(promises);
            if (!alive) return;
            setTmdbItems(results.filter(Boolean) as TmdbItem[]);
        })();

        return () => { alive = false; };
    }, [movieIds, seriesIds]);

    const movieCount = watchlist?.movieId.length ?? 0;
    const seriesCount = watchlist?.seriesId.length ?? 0;
    const totalCount = movieCount + seriesCount;

    const isBanned = !!user?.reviewBannedUntil && new Date(user.reviewBannedUntil) > new Date();
    const bannedUntil = user?.reviewBannedUntil ? new Date(user.reviewBannedUntil) : null;
    function Badge({ name, color }: { name: string; color: string }) {
        return (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${color}`}>{name}</span>
        );
    }

    function Achievement({ title, progress }: { title: string; progress: number }) {
        return (
            <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                <p className="text-sm mb-2">{title}</p>
                <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(progress * 100, 100)}%` }}
                        className="h-2 bg-[#e94f37] rounded-full"
                    />
                </div>
                <p className="text-xs mt-1 text-gray-400">{Math.min(Math.floor(progress * 100), 100)}% complete</p>
            </div>
        );
    }

    function GenreBadge({ name, color }: { name: string; color: string }) {
        return (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${color}`}>{name}</span>
        );
    }
    /* ---------------- Render ---------------- */
    return (
        <main className="min-h-screen bg-black text-white">
            <div className="mx-auto w-full max-w-7xl px-6 py-26">
                {/* Hero */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-12">
                    <div className="flex items-center gap-6">
                        <div className="relative w-28 h-28 rounded-full overflow-hidden ring-4 ring-[#e94f37]/40 bg-zinc-900">
                            {user?.avatarUrl ? <Image src={user.avatarUrl} alt="avatar" fill className="object-cover" /> :
                                <div className="flex items-center justify-center w-full h-full text-4xl font-bold text-white/60">{(user?.name || "U")[0]}</div>}
                        </div>
                        <div>
                            <h1 className="text-4xl font-black">{user?.name ?? "Your Profile"}</h1>
                            <p className="text-gray-400">@{user?.username ?? "user"}</p>
                            <div className="mt-2 flex flex-wrap gap-2 items-center">
                                <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs font-semibold">{user?.role ?? "user"}</span>
                                {isBanned && <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-300 text-xs font-semibold">Banned until {bannedUntil?.toLocaleDateString()}</span>}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="px-4 py-2 rounded bg-[#e94f37] hover:bg-[#ff5746] transition" onClick={() => setEditOpen(true)}>Edit Profile</button>
                        <Link href="/settings" className="px-4 py-2 rounded border border-white/10 hover:bg-white/5 transition">Settings</Link>
                        <button className="px-4 py-2 rounded border border-red-500/30 hover:bg-red-500/10 transition" onClick={logoutSilent}>Logout</button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-6 border-b border-white/10 mb-6">
                    {["profile", "watchlist", "reviews"].map((t) => (
                        <button key={t} className={`pb-2 text-sm font-semibold ${tab === t ? "border-b-2 border-[#e94f37] text-[#e94f37]" : "text-gray-400"}`} onClick={() => setTab(t as any)}>
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    {tab === "profile" && (
                        <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            {/* Stats */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                                <StatCard label="Movies Saved" value={movieCount} icon={<Film />} />
                                <StatCard label="Series Saved" value={seriesCount} icon={<Tv />} />
                                <StatCard label="Total Watchlist" value={totalCount} icon={<Bookmark />} />
                                <StatCard label="Reviews" value="Coming Soon" />
                            </div>

                            {/* Badges */}
                            <div className="mb-8">
                                <h2 className="text-2xl font-bold mb-4">Badges</h2>
                                <div className="flex flex-wrap gap-3">
                                    {/* Mocked badges */}
                                    <Badge name="Top Reviewer" color="bg-yellow-500/20 text-yellow-400" />
                                    <Badge name="Movie Buff" color="bg-red-500/20 text-red-400" />
                                    <Badge name="Series Addict" color="bg-blue-500/20 text-blue-400" />
                                </div>
                            </div>

                            {/* Achievements */}
                            <div className="mb-8">
                                <h2 className="text-2xl font-bold mb-4">Achievements</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                    <Achievement title="Watched 50 Movies" progress={movieCount / 50} />
                                    <Achievement title="Reviewed 10 Series" progress={0.2} />
                                    <Achievement title="Saved 100 Items" progress={totalCount / 100} />
                                </div>
                            </div>

                            {/* Favorite genres */}
                            <div className="mb-8">
                                <h2 className="text-2xl font-bold mb-4">Favorite Genres</h2>
                                <div className="flex flex-wrap gap-2">
                                    {/* Mocked genres */}
                                    <GenreBadge name="Action" color="bg-red-500/20 text-red-400" />
                                    <GenreBadge name="Comedy" color="bg-yellow-500/20 text-yellow-400" />
                                    <GenreBadge name="Sci-Fi" color="bg-purple-500/20 text-purple-400" />
                                    <GenreBadge name="Drama" color="bg-blue-500/20 text-blue-400" />
                                </div>
                            </div>
                        </motion.div>

                    )}

                    {tab === "watchlist" && (
                        <motion.div key="watchlist" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4">
                                {loading && Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-[2/3] rounded-xl bg-zinc-900 animate-pulse" />)}

                                {!loading && tmdbItems.map((item) => {
                                    const title = item.kind === "movie" ? item.title : item.name;
                                    const href = item.kind === "movie" ? `/movies/${item.id}` : `/tv/${item.id}`;
                                    const poster = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "/coming-soon.png";

                                    return (
                                        <motion.div key={`${item.kind}-${item.id}`} whileHover={{ scale: 1.05 }} className="relative group cursor-pointer rounded-2xl overflow-hidden aspect-[2/3] bg-zinc-900">
                                            <Link href={href} className="block h-full w-full">
                                                <Image src={poster} alt={title} fill className="object-cover transition-transform duration-500 group-hover:scale-110" />
                                                {item.vote_average && (
                                                    <div className="absolute top-2 right-2 bg-black/80 px-2 py-1 rounded text-xs flex items-center gap-1 text-yellow-400">
                                                        <Star className="w-3 h-3" /> {item.vote_average.toFixed(1)}
                                                    </div>
                                                )}
                                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                                    <p className="text-xs sm:text-sm font-semibold line-clamp-2">{title}</p>
                                                </div>
                                            </Link>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}

                    {tab === "reviews" && (
                        <motion.div key="reviews" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <p className="text-gray-400">Reviews tab coming soon.</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ---------------- Edit Profile Modal ---------------- */}
                <AnimatePresence>
                    {editOpen && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                        >
                            <motion.div
                                initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
                                className="w-full max-w-lg bg-black rounded-xl p-6 border border-white/10"
                            >
                                <h2 className="text-xl font-semibold mb-4">Edit Profile</h2>
                                <p className="text-gray-400 mb-4">Form integration with /user/edit should go here</p>
                                <div className="flex justify-end gap-2">
                                    <button className="px-4 py-2 rounded border" onClick={() => setEditOpen(false)}>Cancel</button>
                                    <button className="px-4 py-2 rounded bg-[#e94f37]">Save</button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </main>
    );
}

/* ---------------- UI Components ---------------- */
function StatCard({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex items-center gap-4">
            {icon && <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">{icon}</div>}
            <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
                <p className="text-xl font-bold mt-0.5">{value}</p>
            </div>
        </div>
    );
}
