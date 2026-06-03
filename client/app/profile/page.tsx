"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Film, Tv, Bookmark, Settings, LogOut, Star, TrendingUp, Award, Target, Calendar, Search, Filter, Grid, List, Heart, Eye, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/app/context/AuthProvider";
import { FilterDropdown } from "@/components/ui/filterdropdown";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || "";
const TMDB_READ_TOKEN = process.env.NEXT_PUBLIC_TMDB_READ_TOKEN || "";

type Watchlist = { movieId: string[]; seriesId: string[] };
type ServerUser = {
    id?: string;
    name?: string | null;
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

type UserReview = {
    id: string;
    tmdbId: number;
    mediaType: "MOVIE" | "TV";
    rating: number;
    content: string;
    moodEmojis: string[];
    status: string;
    createdAt: string;
    // enriched from TMDB
    tmdbTitle?: string;
    tmdbPoster?: string | null;
    tmdbYear?: string;
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
    const [reviews, setReviews] = useState<UserReview[]>([]);
    const [reviewsLoading, setReviewsLoading] = useState(false);
    const [reviewsVisible, setReviewsVisible] = useState(3);
    const [cardReviewsVisible, setCardReviewsVisible] = useState<Record<string, number>>({});
    const [reviewTypeFilter, setReviewTypeFilter] = useState<"all" | "MOVIE" | "TV">("all");
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [avatarLightbox, setAvatarLightbox] = useState(false);
    const [profileName, setProfileName] = useState("");
    const [profileUsername, setProfileUsername] = useState("");
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileError, setProfileError] = useState<string | null>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    const handleAvatarFile = useCallback((file: File) => {
        if (!file.type.startsWith("image/")) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const src = e.target?.result as string;
            const img = new window.Image();
            img.onload = () => {
                const MAX = 800;
                const scale = Math.min(MAX / img.width, MAX / img.height, 1);
                const canvas = document.createElement("canvas");
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
                setAvatarPreview(dataUrl);
            };
            img.src = src;
        };
        reader.readAsDataURL(file);
    }, []);

    const saveAvatar = useCallback(async () => {
        if (!avatarPreview || !token) return;
        setAvatarUploading(true);
        try {
            const res = await fetch(`${API_BASE}/auth/me/avatar`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ avatarUrl: avatarPreview }),
            });
            if (res.ok) {
                const data = await res.json();
                setProfile((prev) => prev ? { ...prev, avatarUrl: data.avatarUrl } : prev);
                setAvatarPreview(null);
            }
        } finally {
            setAvatarUploading(false);
        }
    }, [avatarPreview, token]);

    const saveProfile = useCallback(async () => {
        if (!token) return;
        setProfileSaving(true);
        setProfileError(null);
        try {
            const body: { name?: string; username?: string } = {};
            if (profileName.trim()) body.name = profileName.trim();
            if (profileUsername.trim()) body.username = profileUsername.trim();

            const [profileRes, avatarRes] = await Promise.all([
                Object.keys(body).length > 0
                    ? fetch(`${API_BASE}/auth/me/profile`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify(body),
                    })
                    : Promise.resolve(null),
                avatarPreview
                    ? fetch(`${API_BASE}/auth/me/avatar`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ avatarUrl: avatarPreview }),
                    })
                    : Promise.resolve(null),
            ]);

            if (profileRes && !profileRes.ok) {
                const err = await profileRes.json().catch(() => ({}));
                setProfileError(err?.message ?? "Failed to update profile");
                return;
            }

            const updates: Partial<typeof profile> = {};
            if (profileRes?.ok) {
                const d = await profileRes.json();
                if (d.name !== undefined) updates.name = d.name;
                if (d.username !== undefined) updates.username = d.username;
            }
            if (avatarRes?.ok) {
                const d = await avatarRes.json();
                updates.avatarUrl = d.avatarUrl;
            }

            if (Object.keys(updates).length > 0) {
                setProfile((prev) => prev ? { ...prev, ...updates } : prev);
            }
            setAvatarPreview(null);
            setEditOpen(false);
        } finally {
            setProfileSaving(false);
        }
    }, [token, profileName, profileUsername, avatarPreview, profile]);

    const user = profile ?? (decodedUser as ServerUser | null);

    // Group reviews by media (tmdbId + mediaType)
    const mediaGroups = useMemo(() => {
        const map = new Map<string, { key: string; reviews: UserReview[] }>();
        for (const r of reviews) {
            const key = `${r.mediaType}-${r.tmdbId}`;
            if (!map.has(key)) map.set(key, { key, reviews: [] });
            map.get(key)!.reviews.push(r);
        }
        return Array.from(map.values());
    }, [reviews]);

    const filteredMediaGroups = useMemo(() => {
        if (reviewTypeFilter === "all") return mediaGroups;
        return mediaGroups.filter(g => g.reviews[0].mediaType === reviewTypeFilter);
    }, [mediaGroups, reviewTypeFilter]);

    /* ---------------- Fetch reviews when tab active ---------------- */
    useEffect(() => {
        if (tab !== "reviews" || !token) return;
        let alive = true;
        setReviewsLoading(true);

        (async () => {
            try {
                const res = await fetch(`${API_BASE}/reviews/me?limit=200`, {
                    headers: { Authorization: `Bearer ${token}` },
                    cache: "no-store",
                });
                if (!alive) return;
                if (!res.ok) return;
                const data = await res.json();
                const raw: UserReview[] = data.reviews ?? [];

                // Enrich each review with TMDB metadata
                const enriched = await Promise.all(
                    raw.map(async (r) => {
                        const kind = r.mediaType === "MOVIE" ? "movie" : "tv";
                        const url = `https://api.themoviedb.org/3/${kind}/${r.tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`;
                        try {
                            const tmdb = await fetch(url).then((x) => x.json());
                            return {
                                ...r,
                                tmdbTitle: kind === "movie" ? tmdb.title : tmdb.name,
                                tmdbPoster: tmdb.poster_path ?? null,
                                tmdbYear: (kind === "movie" ? tmdb.release_date : tmdb.first_air_date)?.split("-")[0],
                            };
                        } catch {
                            return r;
                        }
                    })
                );
                if (alive) setReviews(enriched);
            } finally {
                if (alive) setReviewsLoading(false);
            }
        })();

        return () => { alive = false; };
    }, [tab, token]);

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

    function ReviewEmptyState({ filter }: { filter: "all" | "MOVIE" | "TV" }) {
        const isMovie = filter === "MOVIE";
        const isTv = filter === "TV";
        const heading = isMovie
            ? "No movie reviews yet"
            : isTv
                ? "No series reviews yet"
                : "Share your first review";
        const sub = isMovie
            ? "You haven’t reviewed any movies yet. Watched something great? Rate it and your thoughts will collect here."
            : isTv
                ? "You haven’t reviewed any TV series yet. Just finished a show? Share your take and it’ll show up here."
                : "You haven’t reviewed anything yet. Rate a movie or series and your reviews will collect here.";

        return (
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent px-6 py-10 sm:px-10 sm:py-14">
                <div aria-hidden className="pointer-events-none absolute -top-12 -right-12 w-44 h-44 rounded-full bg-[#e94f37]/15 blur-3xl" />
                <div className="relative flex flex-col items-center text-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-[#e94f37]/15 border border-[#e94f37]/25 flex items-center justify-center">
                        {isTv ? <Tv className="w-7 h-7 text-[#e94f37]" /> : <Film className="w-7 h-7 text-[#e94f37]" />}
                    </div>
                    <div className="space-y-1.5 max-w-md">
                        <h3 className="text-lg sm:text-xl font-bold text-white">{heading}</h3>
                        <p className="text-sm sm:text-base text-white/50 leading-relaxed">{sub}</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2.5 mt-1">
                        {!isTv && (
                            <Link href="/movies" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#e94f37] hover:bg-[#ff5746] text-white text-sm font-semibold transition">
                                <Film className="w-4 h-4" /> Review a movie
                            </Link>
                        )}
                        {!isMovie && (
                            <Link href="/tv" className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${isTv ? "bg-[#e94f37] hover:bg-[#ff5746] text-white" : "border border-white/15 text-white/80 hover:bg-white/5"}`}>
                                <Tv className="w-4 h-4" /> Review a series
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-black text-white pb-8">
            <div className="mx-auto w-full max-w-7xl px-8 sm:px-14 py-24">
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
                                    onClick={() => user?.avatarUrl && setAvatarLightbox(true)}
                                    className={`relative w-20 h-20 sm:w-28 sm:h-28 rounded-2xl overflow-hidden ring-2 ring-[#e94f37]/60 bg-zinc-900 flex-shrink-0${user?.avatarUrl ? " cursor-pointer hover:ring-[#e94f37] transition-shadow" : ""}`}
                                >
                                    {user?.avatarUrl ? (
                                        <Image src={user.avatarUrl} alt="avatar" fill
            sizes="40px" className="object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                        <div className="flex items-center justify-center w-full h-full text-3xl sm:text-5xl font-bold bg-[#e94f37] text-white">
                                            {(user?.name || "U")[0]}
                                        </div>
                                    )}
                                </motion.div>

                                <div className="flex-1 min-w-0">
                                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-black truncate">{user?.name || user?.username || "Your Profile"}</h1>
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
                                    onClick={() => {
                                        setProfileName(user?.name ?? user?.username ?? "");
                                        setProfileUsername(user?.username ?? "");
                                        setProfileError(null);
                                        setEditOpen(true);
                                    }}
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
                            <AnimatePresence mode="wait">
                                {viewMode === "grid" ? (
                                    <motion.div
                                        key="grid"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ duration: 0.2, ease: "easeInOut" }}
                                        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4"
                                    >
                                        {loading && Array.from({ length: 12 }).map((_, i) => (
                                            <div key={i} className="aspect-[2/3] rounded-xl sm:rounded-2xl bg-zinc-900 animate-pulse" />
                                        ))}

                                        {!loading && filteredAndSortedItems.map((item) => {
                                            const title = item.kind === "movie" ? item.title : item.name;
                                            const href = item.kind === "movie" ? `/movies/${item.id}` : `/tv/${item.id}`;
                                            const poster = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "/placeholder-poster.svg";

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
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
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
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="list"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        transition={{ duration: 0.2, ease: "easeInOut" }}
                                        className="space-y-2 sm:space-y-3"
                                    >
                                        {loading && Array.from({ length: 6 }).map((_, i) => (
                                            <div key={i} className="h-20 sm:h-24 rounded-xl bg-zinc-900 animate-pulse" />
                                        ))}

                                        {!loading && filteredAndSortedItems.map((item) => {
                                            const title = item.kind === "movie" ? item.title : item.name;
                                            const href = item.kind === "movie" ? `/movies/${item.id}` : `/tv/${item.id}`;
                                            const poster = item.poster_path ? `https://image.tmdb.org/t/p/w200${item.poster_path}` : "/placeholder-poster.svg";

                                            return (
                                                <motion.div
                                                    key={`${item.kind}-${item.id}`}
                                                    layout
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: 20 }}
                                                    transition={{ duration: 0.15, ease: "easeOut" }}
                                                    className="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4 hover:bg-white/10 transition-all group"
                                                >
                                                    <Link href={href} className="flex items-center gap-3 sm:gap-4">
                                                        <div className="relative w-12 h-18 sm:w-16 sm:h-24 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-900">
                                                            <Image
                                                                src={poster}
                                                                alt={title || "Poster"}
                                                                fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
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
                                    </motion.div>
                                )}
                            </AnimatePresence>

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
                            {/* Header row */}
                            <div className="flex items-start sm:items-center justify-between gap-4 mb-5">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-6 h-0.5 bg-[#e94f37]" />
                                        <span className="text-[0.62rem] font-bold tracking-[0.2em] uppercase text-white/30">Your Activity</span>
                                    </div>
                                    <h2 className="text-2xl sm:text-3xl font-black text-white">My Reviews</h2>
                                </div>
                                {/* Movie / TV filter tabs */}
                                <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.07] rounded-xl p-1 flex-shrink-0">
                                    {(["all", "MOVIE", "TV"] as const).map((f) => {
                                        const label = f === "all" ? "All" : f === "MOVIE" ? "Movies" : "TV Series";
                                        const count = f === "all" ? reviews.length : reviews.filter(r => r.mediaType === f).length;
                                        return (
                                            <button
                                                key={f}
                                                onClick={() => { setReviewTypeFilter(f); setReviewsVisible(3); }}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                                    reviewTypeFilter === f
                                                        ? "bg-white/[0.08] text-white"
                                                        : "text-white/30 hover:text-white/60"
                                                }`}
                                            >
                                                {label}
                                                <span className={`ml-1.5 text-[0.55rem] ${ reviewTypeFilter === f ? "text-white/40" : "text-white/15"}`}>{count}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Gradient rule */}
                            <div className="mb-8 h-px bg-gradient-to-r from-[rgb(233,79,55)]/30 via-white/[0.06] to-transparent" />

                            {/* Loading skeletons */}
                            {reviewsLoading && (
                                <div className="space-y-5">
                                    {Array.from({ length: 3 }).map((_, i) => (
                                        <div key={i} className="h-48 rounded-2xl bg-white/[0.03] animate-pulse border border-white/[0.05]" />
                                    ))}
                                </div>
                            )}

                            {/* Empty state — covers both "no reviews at all" and "none in this tab" */}
                            {!reviewsLoading && filteredMediaGroups.length === 0 && (
                                <ReviewEmptyState filter={reviewTypeFilter} />
                            )}

                            {/* Review groups — score-stripe card design */}
                            {!reviewsLoading && filteredMediaGroups.length > 0 && (
                                <div className="space-y-1.5">
                                    {filteredMediaGroups.slice(0, reviewsVisible).map((group, gIdx) => {
                                        const rep = group.reviews[0];
                                        const isMovie = rep.mediaType === "MOVIE";
                                        const href = isMovie ? `/movies/${rep.tmdbId}` : `/tv/${rep.tmdbId}`;
                                        const poster = rep.tmdbPoster
                                            ? `https://image.tmdb.org/t/p/w92${rep.tmdbPoster}`
                                            : null;
                                        const visibleCount = cardReviewsVisible[group.key] ?? 1;
                                        const visibleReviews = group.reviews.slice(0, visibleCount);
                                        const hasMore = visibleCount < group.reviews.length;
                                        const hasLess = visibleCount > 1;

                                        return (
                                            <motion.div
                                                key={group.key}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.22, delay: gIdx * 0.05 }}
                                            >
                                                {visibleReviews.map((review, rIdx) => {
                                                    const stars = Math.max(0, Math.min(10, review.rating));
                                                    const accentHex = stars >= 8 ? "#22c55e" : stars >= 6 ? "#e94f37" : stars >= 4 ? "#f59e0b" : "#ef4444";
                                                    return (
                                                        <div
                                                            key={review.id}
                                                            className="flex rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.015] hover:border-white/[0.11] hover:bg-white/[0.03] transition-all duration-300 mb-1.5"
                                                        >
                                                            {/* Score stripe */}
                                                            <div
                                                                className="w-[58px] sm:w-[64px] flex-shrink-0 flex flex-col items-center justify-center gap-1 py-7"
                                                                style={{ background: `${accentHex}12` }}
                                                            >
                                                                <span className="text-2xl font-black leading-none" style={{ color: accentHex }}>{stars}</span>
                                                                <span className="text-[0.44rem] text-white/20 font-semibold tracking-widest uppercase">/ 10</span>
                                                                {review.moodEmojis?.length > 0 && (
                                                                    <div className="flex flex-wrap justify-center gap-0.5 mt-0.5 max-w-[44px]">
                                                                        {review.moodEmojis.slice(0, 2).map((e, i) => (
                                                                            <span key={i} className="text-[0.7rem] leading-none">{e}</span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Poster column */}
                                                            <Link href={href} className="relative w-[56px] sm:w-[72px] flex-shrink-0 border-l border-white/[0.05] overflow-hidden block">
                                                                {poster ? (
                                                                    <Image src={poster} alt="" fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw" className="object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center bg-white/[0.02]">
                                                                        {isMovie ? <Film className="w-3 h-3 text-white/15" /> : <Tv className="w-3 h-3 text-white/15" />}
                                                                    </div>
                                                                )}
                                                            </Link>

                                                            {/* Content */}
                                                            <div className="flex-1 min-w-0 px-3 sm:px-5 py-4 sm:py-5 border-l border-white/[0.05] flex flex-col justify-between">
                                                                {/* Review text */}
                                                                <div className="mb-3 relative">
                                                                    {/* Opening quote mark */}
                                                                    <span
                                                                        className="absolute -top-1 -left-1 text-[1.4rem] font-black leading-none select-none pointer-events-none"
                                                                        style={{ color: accentHex, opacity: 0.35 }}
                                                                    >"</span>
                                                                    <p className="text-[0.82rem] sm:text-[0.95rem] text-white/80 leading-relaxed line-clamp-4 sm:line-clamp-5 pl-4 font-medium tracking-wide">
                                                                        {review.content}
                                                                    </p>
                                                                </div>

                                                                {/* Attribution row — stacks on mobile */}
                                                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 pt-2 border-t border-white/[0.04]">
                                                                    <Link href={href} className="flex items-center gap-1.5 group/attr min-w-0">
                                                                        <span
                                                                            className="text-[0.58rem] font-bold uppercase tracking-[0.12em] flex-shrink-0"
                                                                            style={{ color: `${accentHex}70` }}
                                                                        >
                                                                            {isMovie ? "Movie" : "TV"}
                                                                        </span>
                                                                        <span className="text-white/15 text-[0.5rem]">·</span>
                                                                        <span className="text-[0.85rem] sm:text-[0.95rem] font-semibold text-white/75 group-hover/attr:text-white transition-colors truncate">
                                                                            {rep.tmdbTitle || `#${rep.tmdbId}`}
                                                                        </span>
                                                                        {rep.tmdbYear && (
                                                                            <span className="text-[0.7rem] text-white/45 flex-shrink-0">{rep.tmdbYear}</span>
                                                                        )}
                                                                    </Link>

                                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                                        {review.status === "FLAGGED" && (
                                                                            <span className="text-[0.48rem] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400/70 border border-yellow-500/15">flagged</span>
                                                                        )}
                                                                        {group.reviews.length > 1 && rIdx === 0 && !hasLess && (
                                                                            <span className="text-[0.55rem] text-white/18 font-medium">+{group.reviews.length - 1}</span>
                                                                        )}
                                                                        <span className="text-[0.72rem] sm:text-[0.8rem] text-white/55 font-medium tabular-nums">
                                                                            {new Date(review.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                                                            <span className="text-white/30 mx-0.5">·</span>
                                                                            {new Date(review.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                {/* Per-title expand / collapse */}
                                                {(hasMore || hasLess) && (
                                                    <div className="flex items-center gap-3 px-2 mb-1">
                                                        {hasMore && (
                                                            <>
                                                                <button
                                                                    onClick={() => setCardReviewsVisible((prev) => ({ ...prev, [group.key]: Math.min(visibleCount + 5, group.reviews.length) }))}
                                                                    className="flex items-center gap-1.5 text-[0.70rem] text-white/25 hover:text-white/55 font-medium transition-colors"
                                                                >
                                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                                                                    {group.reviews.length - visibleCount <= 5
                                                                        ? `${group.reviews.length - visibleCount} more`
                                                                        : "5 more"
                                                                    }
                                                                </button>
                                                                {group.reviews.length - visibleCount > 5 && (
                                                                    <button
                                                                        onClick={() => setCardReviewsVisible((prev) => ({ ...prev, [group.key]: group.reviews.length }))}
                                                                        className="flex items-center gap-1.5 text-[0.70rem] text-white/18 hover:text-white/45 font-medium transition-colors"
                                                                    >
                                                                        Show all {group.reviews.length}
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                        {hasLess && (
                                                            <button
                                                                onClick={() => setCardReviewsVisible((prev) => ({ ...prev, [group.key]: 1 }))}
                                                                className="ml-auto flex items-center gap-1.5 text-[0.65rem] text-white/18 hover:text-white/45 font-medium transition-colors"
                                                            >
                                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
                                                                Collapse
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </motion.div>
                                        );
                                    })}

                                    {/* Global show more / collapse */}
                                    {filteredMediaGroups.length > 3 && (
                                        <div className="flex items-center gap-3 pt-2">
                                            {reviewsVisible < filteredMediaGroups.length && (
                                                <button
                                                    onClick={() => setReviewsVisible((v) => v + 3)}
                                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/50 text-sm font-medium hover:bg-white/[0.07] hover:text-white/80 hover:border-white/[0.15] transition-all"
                                                >
                                                    <span>Load more</span>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M6 9l6 6 6-6" />
                                                    </svg>
                                                </button>
                                            )}
                                            {reviewsVisible > 3 && (
                                                <button
                                                    onClick={() => setReviewsVisible(3)}
                                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/30 text-sm font-medium hover:bg-white/[0.05] hover:text-white/60 transition-all"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M18 15l-6-6-6 6" />
                                                    </svg>
                                                    <span>Collapse</span>
                                                </button>
                                            )}
                                            <span className="text-[0.70rem] text-white/20 font-medium ml-auto">
                                                {Math.min(reviewsVisible, filteredMediaGroups.length)} of {filteredMediaGroups.length} titles
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
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
                                            <div className="w-16 h-16 rounded-xl overflow-hidden bg-zinc-800 flex-shrink-0 ring-2 ring-white/10">
                                                {avatarPreview ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={avatarPreview} alt="preview" className="w-full h-full object-cover" />
                                                ) : user?.avatarUrl ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={user.avatarUrl} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-white/60">
                                                        {(user?.name || "U")[0]}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <input
                                                    ref={avatarInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const f = e.target.files?.[0];
                                                        if (f) handleAvatarFile(f);
                                                        e.target.value = "";
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => avatarInputRef.current?.click()}
                                                    className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition text-sm font-semibold"
                                                >
                                                    {avatarPreview ? "Change" : "Upload New"}
                                                </button>
                                                {avatarPreview && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setAvatarPreview(null)}
                                                        className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition text-sm font-semibold text-red-400"
                                                    >
                                                        Remove
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="block text-sm font-semibold text-gray-300">Display Name</label>
                                            <span className={`text-xs tabular-nums ${profileName.length > 48 ? "text-red-400" : "text-gray-500"}`}>
                                                {profileName.length}/50
                                            </span>
                                        </div>
                                        <input
                                            type="text"
                                            value={profileName}
                                            onChange={(e) => setProfileName(e.target.value.slice(0, 50))}
                                            maxLength={50}
                                            className="w-full px-4 py-3 text-sm sm:text-base bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#e94f37]/50 transition"
                                            placeholder="Enter your name"
                                        />
                                        <p className="text-xs text-gray-600 mt-1">2–50 characters</p>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="block text-sm font-semibold text-gray-300">Username</label>
                                            <span className={`text-xs tabular-nums ${profileUsername.length > 18 ? "text-red-400" : "text-gray-500"}`}>
                                                {profileUsername.length}/20
                                            </span>
                                        </div>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
                                            <input
                                                type="text"
                                                value={profileUsername}
                                                onChange={(e) => setProfileUsername(e.target.value.replace(/^@/, "").slice(0, 20))}
                                                maxLength={20}
                                                className="w-full pl-8 pr-4 py-3 text-sm sm:text-base bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#e94f37]/50 transition"
                                                placeholder="username"
                                            />
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">3–20 characters, letters, numbers, underscores only</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold mb-2 text-gray-300">Email</label>
                                        <input
                                            type="email"
                                            value={user?.email ?? ""}
                                            readOnly
                                            className="w-full px-4 py-3 text-sm sm:text-base bg-white/[0.03] border border-white/5 rounded-xl text-gray-500 cursor-not-allowed"
                                        />
                                        <p className="text-xs text-gray-600 mt-1">Email cannot be changed</p>
                                    </div>

                                    {profileError && (
                                        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">{profileError}</p>
                                    )}
                                </div>

                                <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6 sm:mt-8">
                                    <button
                                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 transition font-semibold order-2 sm:order-1"
                                        onClick={() => setEditOpen(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#e94f37] hover:bg-[#ff5746] transition font-semibold order-1 sm:order-2 disabled:opacity-50"
                                        onClick={saveProfile}
                                        disabled={profileSaving || avatarUploading}
                                    >
                                        {profileSaving ? "Saving…" : "Save Changes"}
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        {/* Avatar Lightbox — full-screen */}
            <AnimatePresence>
                {avatarLightbox && user?.avatarUrl && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-8"
                        onClick={() => setAvatarLightbox(false)}
                    >
                        {/* Backdrop */}
                        <div className="absolute inset-0 bg-black/90" />

                        {/* Close button */}
                        <button
                            onClick={() => setAvatarLightbox(false)}
                            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition flex items-center justify-center text-white"
                            aria-label="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Image — fills as much screen as possible */}
                        <motion.img
                            initial={{ scale: 0.92, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.92, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            src={user.avatarUrl}
                            alt="Profile picture"
                            referrerPolicy="no-referrer"
                            onClick={(e) => e.stopPropagation()}
                            className="relative z-10 max-h-[90vh] max-w-[90vw] w-auto h-auto rounded-2xl object-contain shadow-2xl"
                        />
                    </motion.div>
                )}
            </AnimatePresence>
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
