"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Film, Tv, Bookmark, Settings, LogOut, Star, TrendingUp, Award, Target, Calendar, Search, Filter, Grid, List, Heart, Clock, Eye, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/app/context/AuthProvider";
import { FilterDropdown } from "@/components/ui/filterdropdown";

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
    genre_ids?: number[];
};

export default function ProfilePage() {
    const { user: decodedUser, token, logoutSilent } = useAuth();

    const [profile, setProfile] = useState<ServerUser | null>(null);
    const [watchlist, setWatchlist] = useState<Watchlist | null>(null);
    const [tmdbItems, setTmdbItems] = useState<TmdbItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<"profile" | "watchlist" | "reviews">("profile");
    const [editOpen, setEditOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState<"all" | "movie" | "tv">("all");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [sortBy, setSortBy] = useState<"dateAdded" | "rating" | "title">("dateAdded");
    const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

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

    // Filter and sort watchlist
    const filteredAndSortedItems = useMemo(() => {
        let items = [...tmdbItems];

        if (filterType !== "all") {
            items = items.filter(item => item.kind === filterType);
        }

        if (searchQuery) {
            items = items.filter(item => {
                const title = (item.kind === "movie" ? item.title : item.name) || "";
                return title.toLowerCase().includes(searchQuery.toLowerCase());
            });
        }

        items.sort((a, b) => {
            if (sortBy === "title") {
                const titleA = (a.kind === "movie" ? a.title : a.name) || "";
                const titleB = (b.kind === "movie" ? b.title : b.name) || "";
                return titleA.localeCompare(titleB);
            }
            if (sortBy === "rating") {
                return (b.vote_average || 0) - (a.vote_average || 0);
            }
            return 0;
        });

        return items;
    }, [tmdbItems, filterType, searchQuery, sortBy]);

    const averageRating = useMemo(() => {
        if (tmdbItems.length === 0) return 0;
        const sum = tmdbItems.reduce((acc, item) => acc + (item.vote_average || 0), 0);
        return sum / tmdbItems.length;
    }, [tmdbItems]);

    const isBanned = !!user?.reviewBannedUntil && new Date(user.reviewBannedUntil) > new Date();
    const bannedUntil = user?.reviewBannedUntil ? new Date(user.reviewBannedUntil) : null;

    function Badge({ name, color, icon }: { name: string; color: string; icon?: React.ReactNode }) {
        return (
            <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${color} flex items-center gap-1.5 transition-all hover:scale-105`}>
                {icon}
                <span>{name}</span>
            </div>
        );
    }

    function Achievement({ title, description, progress, icon }: { title: string; description: string; progress: number; icon: React.ReactNode }) {
        const percentage = Math.min(Math.floor(progress * 100), 100);
        const isComplete = percentage >= 100;

        return (
            <div className={`bg-white/5 p-4 rounded-xl border ${isComplete ? 'border-[#e94f37]/40' : 'border-white/10'} transition-all hover:scale-105`}>
                <div className="flex items-start gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-lg ${isComplete ? 'bg-[#e94f37]' : 'bg-white/10'} flex items-center justify-center flex-shrink-0`}>
                        {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm mb-1">{title}</p>
                        <p className="text-xs text-gray-400 line-clamp-2">{description}</p>
                    </div>
                </div>
                <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-2 bg-[#e94f37] rounded-full"
                    />
                </div>
                <p className="text-xs mt-2 text-gray-400 font-semibold">{percentage}% complete</p>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-black text-white pb-8">
            <div className="mx-auto w-full max-w-7xl px-8 sm:px-14 py-6 sm:py-26">
                {/* Hero Section */}
                <div className="mb-8 sm:mb-12">
                    <div className="flex flex-col gap-4 sm:gap-6">
                        {/* Profile Info */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 sm:justify-between">
                            {/* Left: Avatar + Name */}
                            <div className="flex items-start sm:items-center gap-4 sm:gap-6 flex-1 min-w-0">
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="relative w-20 h-20 sm:w-28 sm:h-28 rounded-2xl overflow-hidden ring-2 ring-[#e94f37]/60 bg-zinc-900 flex-shrink-0"
                                >
                                    {user?.avatarUrl ? (
                                        <Image src={user.avatarUrl} alt="avatar" fill className="object-cover" />
                                    ) : (
                                        <div className="flex items-center justify-center w-full h-full text-3xl sm:text-5xl font-bold bg-[#e94f37] text-white">
                                            {(user?.name || "U")[0]}
                                        </div>
                                    )}
                                </motion.div>

                                <div className="flex-1 min-w-0">
                                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-black truncate">{user?.name ?? "Your Profile"}</h1>
                                    <p className="text-gray-400 text-sm sm:text-base mt-1">@{user?.username ?? "user"}</p>
                                    <div className="mt-2 sm:mt-3 flex flex-wrap gap-2 items-center">
                                        <span className="px-2 sm:px-3 py-1 rounded-lg bg-[#e94f37]/20 text-[#e94f37] text-xs font-bold uppercase">
                                            {user?.role ?? "user"}
                                        </span>
                                        {isBanned && (
                                            <span className="px-2 sm:px-3 py-1 rounded-lg bg-yellow-500/20 text-yellow-300 text-xs font-semibold">
                                                Banned until {bannedUntil?.toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right: Actions - now on same row as profile */}
                            <div className="mt-2 sm:mt-0 sm:ml-4 flex items-center gap-2 sm:gap-3">
                                <button
                                    className="px-3 sm:px-4 py-2 rounded-xl bg-[#e94f37] hover:bg-[#ff5746] transition font-semibold text-sm"
                                    onClick={() => setEditOpen(true)}
                                >
                                    Edit
                                </button>
                                <Link href="/settings" className="px-2 sm:px-3 py-2 rounded-xl border border-white/10 hover:bg-white/5 transition flex items-center">
                                    <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                                </Link>
                                <button
                                    className="px-2 sm:px-3 py-2 rounded-xl border border-red-500/30 hover:bg-red-500/10 transition text-red-400 flex items-center"
                                    onClick={logoutSilent}
                                >
                                    <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Action Buttons (mobile extra spacing removed) */}
                        {/* kept removed; actions are now inline with profile */}
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-10">
                    <StatCard
                        label="Movies"
                        value={movieCount}
                        icon={<Film className="w-4 h-4 sm:w-5 sm:h-5" />}
                        trend="+12%"
                    />
                    <StatCard
                        label="TV Series"
                        value={seriesCount}
                        icon={<Tv className="w-4 h-4 sm:w-5 sm:h-5" />}
                        trend="+8%"
                    />
                    <StatCard
                        label="Total Items"
                        value={totalCount}
                        icon={<Bookmark className="w-4 h-4 sm:w-5 sm:h-5" />}
                    />
                    <StatCard
                        label="Avg Rating"
                        value={averageRating.toFixed(1)}
                        icon={<Star className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />}
                    />
                </div>

                {/* Tabs – comfortable & touch-friendly */}
                <div className="flex gap-1.5 sm:gap-2 mb-6 sm:mb-8 bg-white/5 p-1.5 rounded-2xl border border-white/10 overflow-x-auto">
                    {["profile", "watchlist", "reviews"].map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t as any)}
                            className={`
        whitespace-nowrap
        px-3 sm:px-4
        py-1.5 sm:py-2
        rounded-xl
        text-xs sm:text-sm
        font-medium
        transition-all duration-200
        ${tab === t
                                    ? "bg-[#e94f37] text-white shadow-sm"
                                    : "text-gray-400 hover:text-white hover:bg-white/10"
                                }
      `}
                        >
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                    ))}
                </div>


                <AnimatePresence mode="wait">
                    {tab === "profile" && (
                        <motion.div
                            key="profile"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            {/* Achievements */}
                            <div className="mb-8 sm:mb-10">
                                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
                                    <Award className="w-6 h-6 sm:w-8 sm:h-8 text-[#e94f37]" />
                                    Achievements
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                    <Achievement
                                        title="Movie Collector"
                                        description="Save 50 movies to your watchlist"
                                        progress={movieCount / 50}
                                        icon={<Film className="w-4 h-4 sm:w-5 sm:h-5" />}
                                    />
                                    <Achievement
                                        title="Binge Watcher"
                                        description="Add 25 TV series"
                                        progress={seriesCount / 25}
                                        icon={<Tv className="w-4 h-4 sm:w-5 sm:h-5" />}
                                    />
                                    <Achievement
                                        title="Century Club"
                                        description="Reach 100 total items"
                                        progress={totalCount / 100}
                                        icon={<Target className="w-4 h-4 sm:w-5 sm:h-5" />}
                                    />
                                    <Achievement
                                        title="Critic's Choice"
                                        description="Write 10 reviews"
                                        progress={0.2}
                                        icon={<Star className="w-4 h-4 sm:w-5 sm:h-5" />}
                                    />
                                    <Achievement
                                        title="Dedicated Fan"
                                        description="Use the app for 30 days"
                                        progress={0.6}
                                        icon={<Calendar className="w-4 h-4 sm:w-5 sm:h-5" />}
                                    />
                                    <Achievement
                                        title="Completionist"
                                        description="Mark 50 items as watched"
                                        progress={0.4}
                                        icon={<Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                                    />
                                </div>
                            </div>

                            {/* Badges */}
                            <div className="mb-8 sm:mb-10">
                                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
                                    <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-[#e94f37]" />
                                    Earned Badges
                                </h2>
                                <div className="flex flex-wrap gap-2 sm:gap-3">
                                    <Badge
                                        name="Top Reviewer"
                                        color="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                                        icon={<Award className="w-3 h-3 sm:w-4 sm:h-4" />}
                                    />
                                    <Badge
                                        name="Movie Buff"
                                        color="bg-red-500/20 text-red-400 border border-red-500/30"
                                        icon={<Film className="w-3 h-3 sm:w-4 sm:h-4" />}
                                    />
                                    <Badge
                                        name="Series Addict"
                                        color="bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                        icon={<Tv className="w-3 h-3 sm:w-4 sm:h-4" />}
                                    />
                                    <Badge
                                        name="Early Adopter"
                                        color="bg-purple-500/20 text-purple-400 border border-purple-500/30"
                                        icon={<Star className="w-3 h-3 sm:w-4 sm:h-4" />}
                                    />
                                </div>
                            </div>

                            {/* Activity Summary */}
                            <div className="bg-white/5 p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-white/10">
                                <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-3 sm:mb-4">Recent Activity</h2>
                                <div className="space-y-2 sm:space-y-3">
                                    <ActivityItem
                                        icon={<Bookmark className="w-3 h-3 sm:w-4 sm:h-4" />}
                                        text="Added 3 new movies to watchlist"
                                        time="2 hours ago"
                                    />
                                    <ActivityItem
                                        icon={<Star className="w-3 h-3 sm:w-4 sm:h-4" />}
                                        text="Rated 'Inception' 5 stars"
                                        time="1 day ago"
                                    />
                                    <ActivityItem
                                        icon={<Heart className="w-3 h-3 sm:w-4 sm:h-4" />}
                                        text="Marked 'Breaking Bad' as favorite"
                                        time="3 days ago"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {tab === "watchlist" && (
                        <motion.div
                            key="watchlist"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            {/* Search and Filters - now same row on desktop */}
                            <div className="mb-4 sm:mb-6">
                                <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
                                    <div className="relative flex-1 w-full">
                                        <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Search your watchlist..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 text-sm sm:text-base bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#e94f37]/50 transition"
                                        />
                                    </div>

                                    {/* Desktop Filters inline */}
                                    <div className="hidden sm:flex items-center gap-3">
                                        <FilterDropdown
                                            value={filterType}
                                            onChange={setFilterType}
                                            options={[
                                                { label: "All Types", value: "all" },
                                                { label: "Movies", value: "movie" },
                                                { label: "TV Series", value: "tv" },
                                            ]}
                                        />

                                        <FilterDropdown
                                            value={sortBy}
                                            onChange={setSortBy}
                                            options={[
                                                { label: "Date Added", value: "dateAdded" },
                                                { label: "Rating", value: "rating" },
                                                { label: "Title", value: "title" },
                                            ]}
                                        />


                                        {/* View toggle */}
                                        <div className="flex items-center gap-1 bg-neutral-900/80 border border-white/10 rounded-xl p-1">
                                            <button
                                                onClick={() => setViewMode("grid")}
                                                className={`
        p-2 rounded-lg transition
        ${viewMode === "grid"
                                                        ? "bg-[#e94f37] text-white"
                                                        : "text-gray-400 hover:bg-white/5 hover:text-white"}
      `}
                                            >
                                                <Grid className="w-4 h-4" />
                                            </button>

                                            <button
                                                onClick={() => setViewMode("list")}
                                                className={`
        p-2 rounded-lg transition
        ${viewMode === "list"
                                                        ? "bg-[#e94f37] text-white"
                                                        : "text-gray-400 hover:bg-white/5 hover:text-white"}
      `}
                                            >
                                                <List className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>


                                    {/* Mobile Filter Button */}
                                    <div className="flex sm:hidden gap-2 w-full">
                                        <button
                                            onClick={() => setMobileFilterOpen(true)}
                                            className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                                        >
                                            <Filter className="w-4 h-4" />
                                            Filters & Sort
                                        </button>
                                        <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
                                            <button
                                                onClick={() => setViewMode("grid")}
                                                className={`p-2 rounded-lg transition ${viewMode === "grid" ? "bg-[#e94f37]" : ""}`}
                                            >
                                                <Grid className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setViewMode("list")}
                                                className={`p-2 rounded-lg transition ${viewMode === "list" ? "bg-[#e94f37]" : ""}`}
                                            >
                                                <List className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                </div>

                                <div className="flex items-center justify-between text-xs sm:text-sm text-gray-400 mt-2">
                                    <p>Showing {filteredAndSortedItems.length} of {totalCount} items</p>
                                </div>
                            </div>

                            {/* Watchlist Grid/List */}
                            {viewMode === "grid" ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                                    {loading && Array.from({ length: 12 }).map((_, i) => (
                                        <div key={i} className="aspect-[2/3] rounded-xl sm:rounded-2xl bg-zinc-900 animate-pulse" />
                                    ))}

                                    {!loading && filteredAndSortedItems.map((item) => {
                                        const title = item.kind === "movie" ? item.title : item.name;
                                        const href = item.kind === "movie" ? `/movies/${item.id}` : `/tv/${item.id}`;
                                        const poster = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "/coming-soon.png";

                                        return (
                                            <motion.div
                                                key={`${item.kind}-${item.id}`}
                                                layout
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                whileHover={{ scale: 1.05, y: -5 }}
                                                className="relative group cursor-pointer rounded-xl sm:rounded-2xl overflow-hidden aspect-[2/3] bg-zinc-900 shadow-lg hover:shadow-2xl hover:shadow-[#e94f37]/20 transition-shadow"
                                            >
                                                <Link href={href} className="block h-full w-full">
                                                    <Image
                                                        src={poster}
                                                        alt={title || "Poster"}
                                                        fill
                                                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                                    {item.vote_average && (
                                                        <div className="absolute top-2 sm:top-3 right-2 sm:right-3 bg-black/90 px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-xs flex items-center gap-1 sm:gap-1.5 text-yellow-400 font-semibold">
                                                            <Star className="w-3 h-3 fill-yellow-400" />
                                                            {item.vote_average.toFixed(1)}
                                                        </div>
                                                    )}

                                                    <div className="absolute top-2 sm:top-3 left-2 sm:left-3 bg-black/90 px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-xs font-semibold">
                                                        {item.kind === "movie" ? <Film className="w-3 h-3" /> : <Tv className="w-3 h-3" />}
                                                    </div>

                                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2 sm:p-4">
                                                        <p className="text-xs sm:text-sm font-bold line-clamp-2 mb-0.5 sm:mb-1">{title}</p>
                                                        <p className="text-xs text-gray-400">
                                                            {item.kind === "movie" ? item.release_date?.split("-")[0] : item.first_air_date?.split("-")[0]}
                                                        </p>
                                                    </div>
                                                </Link>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="space-y-2 sm:space-y-3">
                                    {loading && Array.from({ length: 6 }).map((_, i) => (
                                        <div key={i} className="h-20 sm:h-24 rounded-xl bg-zinc-900 animate-pulse" />
                                    ))}

                                    {!loading && filteredAndSortedItems.map((item) => {
                                        const title = item.kind === "movie" ? item.title : item.name;
                                        const href = item.kind === "movie" ? `/movies/${item.id}` : `/tv/${item.id}`;
                                        const poster = item.poster_path ? `https://image.tmdb.org/t/p/w200${item.poster_path}` : "/coming-soon.png";

                                        return (
                                            <motion.div
                                                key={`${item.kind}-${item.id}`}
                                                layout
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 20 }}
                                                className="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4 hover:bg-white/10 transition-all group"
                                            >
                                                <Link href={href} className="flex items-center gap-3 sm:gap-4">
                                                    <div className="relative w-12 h-18 sm:w-16 sm:h-24 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-900">
                                                        <Image
                                                            src={poster}
                                                            alt={title || "Poster"}
                                                            fill
                                                            className="object-cover"
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-semibold text-sm sm:text-lg mb-1 truncate group-hover:text-[#e94f37] transition">{title}</h3>
                                                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-400">
                                                            <span className="flex items-center gap-1">
                                                                {item.kind === "movie" ? <Film className="w-3 h-3 sm:w-4 sm:h-4" /> : <Tv className="w-3 h-3 sm:w-4 sm:h-4" />}
                                                                <span className="hidden sm:inline">{item.kind === "movie" ? "Movie" : "TV Series"}</span>
                                                            </span>
                                                            {(item.release_date || item.first_air_date) && (
                                                                <span className="flex items-center gap-1">
                                                                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                                                                    {item.kind === "movie" ? item.release_date?.split("-")[0] : item.first_air_date?.split("-")[0]}
                                                                </span>
                                                            )}
                                                            {item.vote_average && (
                                                                <span className="flex items-center gap-1 text-yellow-400 font-semibold">
                                                                    <Star className="w-3 h-3 sm:w-4 sm:h-4 fill-yellow-400" />
                                                                    {item.vote_average.toFixed(1)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </Link>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            )}

                            {!loading && filteredAndSortedItems.length === 0 && (
                                <div className="text-center py-12 sm:py-16">
                                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                                        <Bookmark className="w-8 h-8 sm:w-10 sm:h-10 text-gray-600" />
                                    </div>
                                    <h3 className="text-lg sm:text-xl font-semibold mb-2">No items found</h3>
                                    <p className="text-sm sm:text-base text-gray-400 px-4">
                                        {searchQuery ? "Try adjusting your search or filters" : "Start adding movies and TV shows to your watchlist"}
                                    </p>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {tab === "reviews" && (
                        <motion.div
                            key="reviews"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <div className="text-center py-12 sm:py-16">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#e94f37]/20 flex items-center justify-center mx-auto mb-4">
                                    <Star className="w-8 h-8 sm:w-10 sm:h-10 text-[#e94f37]" />
                                </div>
                                <h3 className="text-xl sm:text-2xl font-bold mb-2">Reviews Coming Soon</h3>
                                <p className="text-sm sm:text-base text-gray-400 max-w-md mx-auto px-4">
                                    This feature is currently in development. Soon you'll be able to write and manage your movie and TV show reviews here.
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Mobile Filter Modal */}
                <AnimatePresence>
                    {mobileFilterOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                            onClick={() => setMobileFilterOpen(false)}
                        >
                            <motion.div
                                initial={{ y: "100%" }}
                                animate={{ y: 0 }}
                                exit={{ y: "100%" }}
                                className="w-full max-w-lg bg-zinc-900 rounded-t-2xl sm:rounded-2xl p-6 border border-white/10"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold">Filters & Sort</h3>
                                    <button onClick={() => setMobileFilterOpen(false)} className="p-2 hover:bg-white/5 rounded-lg transition">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold mb-2 text-gray-400 uppercase tracking-wide">
                                            Filter by Type
                                        </label>

                                        <div className="relative">
                                            <select
                                                value={filterType}
                                                onChange={(e) => setFilterType(e.target.value as any)}
                                                className="
        w-full appearance-none
        px-4 py-3 pr-10
        rounded-xl
        bg-neutral-900/80
        border border-white/10
        text-white
        hover:border-white/20
        focus:outline-none focus:ring-2 focus:ring-[#e94f37]/50
        transition
        cursor-pointer
      "
                                            >
                                                <option value="all">All Types</option>
                                                <option value="movie">Movies</option>
                                                <option value="tv">TV Series</option>
                                            </select>

                                            {/* Arrow */}
                                            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold mb-2 text-gray-400 uppercase tracking-wide">
                                            Sort by
                                        </label>

                                        <div className="relative">
                                            <select
                                                value={sortBy}
                                                onChange={(e) => setSortBy(e.target.value as any)}
                                                className="
        w-full appearance-none
        px-4 py-3 pr-10
        rounded-xl
        bg-neutral-900/80
        border border-white/10
        text-white
        hover:border-white/20
        focus:outline-none focus:ring-2 focus:ring-[#e94f37]/50
        transition
        cursor-pointer
      "
                                            >
                                                <option value="dateAdded">Date Added</option>
                                                <option value="rating">Rating</option>
                                                <option value="title">Title</option>
                                            </select>

                                            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>

                                </div>

                                <button
                                    className="w-full mt-6 px-4 py-3 rounded-xl bg-[#e94f37] hover:bg-[#ff5746] transition font-semibold"
                                    onClick={() => setMobileFilterOpen(false)}
                                >
                                    Apply Filters
                                </button>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Edit Profile Modal */}
                <AnimatePresence>
                    {editOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                            onClick={() => setEditOpen(false)}
                        >
                            <motion.div
                                initial={{ y: "100%", opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: "100%", opacity: 0 }}
                                className="w-full max-w-lg bg-zinc-900 rounded-t-2xl sm:rounded-2xl p-6 sm:p-8 border border-white/10 max-h-[90vh] overflow-y-auto"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <h2 className="text-xl sm:text-2xl font-bold mb-6 flex items-center gap-2 sm:gap-3">
                                    <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-[#e94f37]" />
                                    Edit Profile
                                </h2>

                                <div className="space-y-4 sm:space-y-5">
                                    <div>
                                        <label className="block text-sm font-semibold mb-2 text-gray-300">Profile Picture</label>
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 rounded-xl overflow-hidden bg-zinc-800 flex-shrink-0">
                                                {user?.avatarUrl ? (
                                                    <Image src={user.avatarUrl} alt="avatar" width={64} height={64} className="object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-white/60">
                                                        {(user?.name || "U")[0]}
                                                    </div>
                                                )}
                                            </div>
                                            <button className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition text-sm font-semibold">
                                                Upload New
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold mb-2 text-gray-300">Display Name</label>
                                        <input
                                            type="text"
                                            defaultValue={user?.name}
                                            className="w-full px-4 py-3 text-sm sm:text-base bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#e94f37]/50 transition"
                                            placeholder="Enter your name"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold mb-2 text-gray-300">Username</label>
                                        <input
                                            type="text"
                                            defaultValue={user?.username}
                                            className="w-full px-4 py-3 text-sm sm:text-base bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#e94f37]/50 transition"
                                            placeholder="@username"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold mb-2 text-gray-300">Email</label>
                                        <input
                                            type="email"
                                            defaultValue={user?.email}
                                            className="w-full px-4 py-3 text-sm sm:text-base bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#e94f37]/50 transition"
                                            placeholder="your@email.com"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6 sm:mt-8">
                                    <button
                                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 transition font-semibold order-2 sm:order-1"
                                        onClick={() => setEditOpen(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#e94f37] hover:bg-[#ff5746] transition font-semibold order-1 sm:order-2">
                                        Save Changes
                                    </button>
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
function StatCard({ label, value, icon, trend }: {
    label: string;
    value: string | number;
    icon?: React.ReactNode;
    trend?: string;
}) {
    return (
        <div className="rounded-xl sm:rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-5 flex flex-col gap-2 sm:gap-3 hover:bg-white/10 transition-all">
            <div className="flex items-center justify-between">
                {icon && (
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-white/10 flex items-center justify-center">
                        {icon}
                    </div>
                )}
                {trend && (
                    <span className="text-xs font-semibold text-green-400 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {trend}
                    </span>
                )}
            </div>
            <div>
                <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-0.5 sm:mb-1">{label}</p>
                <p className="text-2xl sm:text-3xl font-black">{value}</p>
            </div>
        </div>
    );
}

function ActivityItem({ icon, text, time }: { icon: React.ReactNode; text: string; time: string }) {
    return (
        <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg hover:bg-white/5 transition">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#e94f37]/20 flex items-center justify-center text-[#e94f37] flex-shrink-0">
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium truncate">{text}</p>
                <p className="text-xs text-gray-500">{time}</p>
            </div>
        </div>
    );
}
