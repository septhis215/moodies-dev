"use client";

import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
} from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Film,
  Tv,
  Bookmark,
  Settings,
  LogOut,
  Star,
  TrendingUp,
  Award,
  Calendar,
  Search,
  Filter,
  Grid,
  List,
  Heart,
  X,
  Sparkles,
  Shield,
  Lock,
  Unlock,
  Flame,
  Medal,
  Camera,
  Mail,
  UserRound,
  Save,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/app/context/AuthProvider";
import { FilterDropdown } from "@/components/ui/filterdropdown";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || "";
const MASCOT_SRC = "/images/moodies-mascot.png";
const LOGO_SRC = "/images/moodies-transparent.png";
const PUBLIC_IMAGE_PATH_PATTERN =
  /^\/images\/.+\.(?:png|jpe?g|webp|gif|svg)(?:[?#].*)?$/i;
const REVIEW_MOOD_LABELS: Record<string, string> = {
  amazing: "Amazing",
  "loved-it": "Loved it",
  "enjoyed-it": "Enjoyed",
  "its-okay": "It's okay",
  meh: "Meh",
  "skip-it": "Disliked",
};

function isPublicImagePath(value: string) {
  return PUBLIC_IMAGE_PATH_PATTERN.test(value.trim());
}

function moodKeyFromValue(value: string) {
  const cleanValue = value.trim().split(/[?#]/)[0] ?? "";
  const fileName = cleanValue.split("/").pop() ?? cleanValue;
  return fileName.replace(/\.[^.]+$/, "").toLowerCase();
}

function titleCaseMoodKey(key: string) {
  return key
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function moodLabelFromValue(value?: string | null) {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return "Mood";

  const key = moodKeyFromValue(trimmedValue);
  if (REVIEW_MOOD_LABELS[key]) return REVIEW_MOOD_LABELS[key];

  return isPublicImagePath(trimmedValue)
    ? titleCaseMoodKey(key)
    : trimmedValue;
}

function ReviewMoodIcon({ value }: { value: string }) {
  const trimmedValue = value.trim();
  const hasImage = isPublicImagePath(trimmedValue);
  const label = moodLabelFromValue(trimmedValue);

  if (!hasImage) {
    return <span className="text-[0.7rem] leading-none">{trimmedValue}</span>;
  }

  return (
    <span
      title={label}
      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/[0.08]"
    >
      <Image
        src={trimmedValue}
        alt={label}
        width={18}
        height={18}
        className="h-4 w-4 object-contain"
      />
    </span>
  );
}

type ProfileDisclosure = {
  profileInfo: boolean;
  watchlist: boolean;
  reviews: boolean;
  liked: boolean;
  badges: boolean;
  recentActivity: boolean;
};

type Watchlist = { movieId: string[]; seriesId: string[] };
type ServerUser = {
  id?: string;
  name?: string | null;
  username?: string;
  email?: string;
  role?: string;
  avatarUrl?: string | null;
  disclosure?: ProfileDisclosure;
  achievements?: UserAchievementView[];
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

type UserAchievementView = {
  achievement: {
    key: string;
    title: string;
    description: string;
    category: string;
    requirementType: string;
    requirementTarget: string;
    requiredCount: number | null;
    reasoningTemplate: string;
    lockedHint: string;
  };
  badge: {
    badgeName: string;
    icon: string;
    rarity: string;
    mascotMood: string;
    mascotMotion: string;
    colorTheme?: { accent?: string; glow?: string };
    displayOrder: number;
  } | null;
  progress: {
    currentProgress: number;
    completionPercentage: number;
    unlocked: boolean;
    unlockedAt?: string | null;
    relatedActivityRef?: string | null;
  };
};

export default function ProfilePage() {
  const { user: decodedUser, isAuthenticated, logout, logoutSilent } = useAuth();

  const [profile, setProfile] = useState<ServerUser | null>(null);
  const [watchlist, setWatchlist] = useState<Watchlist | null>(null);
  const [tmdbItems, setTmdbItems] = useState<TmdbItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"profile" | "watchlist" | "reviews">(
    "profile",
  );
  const [editOpen, setEditOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "movie" | "tv">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"dateAdded" | "rating" | "title">(
    "dateAdded",
  );
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [achievements, setAchievements] = useState<UserAchievementView[]>([]);
  const [reviewsVisible, setReviewsVisible] = useState(3);
  const [cardReviewsVisible, setCardReviewsVisible] = useState<
    Record<string, number>
  >({});
  const [reviewTypeFilter, setReviewTypeFilter] = useState<
    "all" | "MOVIE" | "TV"
  >("all");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarLightbox, setAvatarLightbox] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [disclosure, setDisclosure] = useState({
    profileInfo: true,
    watchlist: true,
    liked: false,
    reviews: true,
    badges: true,
    recentActivity: true,
  });
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
        canvas
          .getContext("2d")!
          .drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        setAvatarPreview(dataUrl);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }, []);

  const saveProfile = useCallback(async () => {
    if (!isAuthenticated) return;
    const name = profileName.trim();
    const username = profileUsername.trim();

    if (name.length < 2 || name.length > 50) {
      setProfileError("Display name must be 2-50 characters.");
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      setProfileError(
        "Username must be 3-20 characters and use only letters, numbers, or underscores.",
      );
      return;
    }

    setProfileSaving(true);
    setProfileError(null);
    try {
      const body: {
        name?: string;
        username?: string;
        disclosure: ProfileDisclosure;
      } = {
        disclosure,
      };
      body.name = name;
      body.username = username;

      const [profileRes, avatarRes] = await Promise.all([
        Object.keys(body).length > 0
          ? fetch(`${API_BASE}/auth/me/profile`, {
              method: "PATCH",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(body),
            })
          : Promise.resolve(null),
        avatarPreview
          ? fetch(`${API_BASE}/auth/me/avatar`, {
              method: "PATCH",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
              },
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
        if (d.disclosure !== undefined) {
          updates.disclosure = d.disclosure;
          setDisclosure(d.disclosure);
        }
      }
      if (avatarRes?.ok) {
        const d = await avatarRes.json();
        updates.avatarUrl = d.avatarUrl;
      }

      if (Object.keys(updates).length > 0) {
        setProfile((prev) => (prev ? { ...prev, ...updates } : prev));
      }
      setAvatarPreview(null);
      setEditOpen(false);
    } finally {
      setProfileSaving(false);
    }
  }, [profileName, profileUsername, avatarPreview, disclosure, isAuthenticated]);

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
    return mediaGroups.filter(
      (g) => g.reviews[0].mediaType === reviewTypeFilter,
    );
  }, [mediaGroups, reviewTypeFilter]);

  /* ---------------- Fetch reviews when tab active ---------------- */
  useEffect(() => {
    if (tab === "watchlist" || !isAuthenticated) return;
    let alive = true;
    setReviewsLoading(true);

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/reviews/me?limit=200`, {
          credentials: "include",
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
                tmdbYear: (kind === "movie"
                  ? tmdb.release_date
                  : tmdb.first_air_date
                )?.split("-")[0],
              };
            } catch {
              return r;
            }
          }),
        );
        if (alive) setReviews(enriched);
      } finally {
        if (alive) setReviewsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [tab, isAuthenticated]);

  /* ---------------- Fetch profile + watchlist ---------------- */
  useEffect(() => {
    if (!isAuthenticated) return;
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const mePromise = fetch(`${API_BASE}/auth/me`, {
          credentials: "include",
          cache: "no-store",
        });
        const watchlistPromise = fetch(`${API_BASE}/watchlist`, {
          credentials: "include",
          cache: "no-store",
        });
        const meRes = await mePromise;

        if (!alive) return;
        if (meRes.status === 401) return logoutSilent();
        if (meRes.ok) {
          const me = await meRes.json();
          setProfile(me);
          if (me.disclosure) {
            setDisclosure((prev) => ({ ...prev, ...me.disclosure }));
          }
        }

        const wlRes = await watchlistPromise;
        if (!alive) return;
        if (wlRes.status === 401) return logoutSilent();
        if (wlRes.ok) setWatchlist(await wlRes.json());
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isAuthenticated, logoutSilent]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let alive = true;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me/achievements`, {
          credentials: "include",
          cache: "no-store",
        });

        if (!alive) return;
        if (res.status === 401) return logoutSilent();
        if (res.ok) {
          const payload = await res.json();
          setAchievements(
            Array.isArray(payload.achievements) ? payload.achievements : [],
          );
        }
      } catch {
        if (alive) setAchievements([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isAuthenticated, logoutSilent]);

  /* ---------------- Fetch TMDB details ---------------- */
  const movieIds = useMemo(() => watchlist?.movieId ?? [], [watchlist]);
  const seriesIds = useMemo(() => watchlist?.seriesId ?? [], [watchlist]);

  useEffect(() => {
    let alive = true;
    const fetchTmdb = async (kind: Kind, id: string) => {
      const url =
        kind === "movie"
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

    return () => {
      alive = false;
    };
  }, [movieIds, seriesIds]);

  const movieCount = watchlist?.movieId.length ?? 0;
  const seriesCount = watchlist?.seriesId.length ?? 0;
  const totalCount = movieCount + seriesCount;

  // Filter and sort watchlist
  const filteredAndSortedItems = useMemo(() => {
    let items = [...tmdbItems];

    if (filterType !== "all") {
      items = items.filter((item) => item.kind === filterType);
    }

    if (searchQuery) {
      items = items.filter((item) => {
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
    const sum = tmdbItems.reduce(
      (acc, item) => acc + (item.vote_average || 0),
      0,
    );
    return sum / tmdbItems.length;
  }, [tmdbItems]);

  const reviewCount = reviews.length;
  const profilePersona = useMemo(() => {
    if (totalCount === 0 && reviewCount === 0) {
      return {
        title: "Fresh Explorer",
        detail: "Start saving and reviewing titles to shape your Moodies read.",
        signal: "New taste profile",
      };
    }
    if (seriesCount > movieCount * 1.2) {
      return {
        title: "Arc Follower",
        detail:
          "Your profile leans toward long-form stories and season-to-season payoff.",
        signal: `${seriesCount} series saved`,
      };
    }
    if (movieCount > seriesCount * 1.2) {
      return {
        title: "Momentum Seeker",
        detail:
          "You move through films with pace and build a watchlist around quick emotional hits.",
        signal: `${movieCount} movies saved`,
      };
    }
    if (averageRating >= 8) {
      return {
        title: "Joy Hunter",
        detail:
          "Your saved titles skew toward crowd-pleasers and confident picks.",
        signal: `${averageRating.toFixed(1)} avg TMDB score`,
      };
    }
    return {
      title: "Mood Cartographer",
      detail:
        "Your taste is balanced across movies and TV, with room for mood-led discovery.",
      signal: `${totalCount} saved titles`,
    };
  }, [averageRating, movieCount, reviewCount, seriesCount, totalCount]);

  const earnedBadges = useMemo(
    () => [
      {
        name: "First Save",
        earned: totalCount >= 1,
        icon: <Bookmark className="w-3.5 h-3.5" />,
      },
      {
        name: "Movie Buff",
        earned: movieCount >= 10,
        icon: <Film className="w-3.5 h-3.5" />,
      },
      {
        name: "Series Scout",
        earned: seriesCount >= 10,
        icon: <Tv className="w-3.5 h-3.5" />,
      },
      {
        name: "Century Club",
        earned: totalCount >= 100,
        icon: <Medal className="w-3.5 h-3.5" />,
      },
      {
        name: "Taste Signal",
        earned: averageRating >= 8 && totalCount >= 5,
        icon: <Sparkles className="w-3.5 h-3.5" />,
      },
      {
        name: "Active Critic",
        earned: reviewCount >= 10,
        icon: <Flame className="w-3.5 h-3.5" />,
      },
    ],
    [averageRating, movieCount, reviewCount, seriesCount, totalCount],
  );
  const achievementRows =
    achievements.length > 0 ? achievements : (user?.achievements ?? []);
  const unlockedAchievementRows = achievementRows.filter(
    (row) => row.progress.unlocked,
  );
  const visibleAchievementRows =
    achievementRows.length > 0 ? achievementRows.slice(0, 9) : [];
  const disclosureItems = [
    ["profileInfo", "Profile info"],
    ["watchlist", "Watchlist"],
    ["liked", "Liked titles"],
    ["reviews", "Reviews"],
    ["badges", "Badges"],
    ["recentActivity", "Recent activity"],
  ] as const;
  const visibleDisclosureCount = disclosureItems.filter(
    ([key]) => disclosure[key],
  ).length;
  const profileCompletion = Math.round(
    ([
      Boolean(user?.name),
      Boolean(user?.username),
      Boolean(user?.avatarUrl),
      totalCount > 0,
      reviewCount > 0,
      unlockedAchievementRows.length > 0,
    ].filter(Boolean).length /
      6) *
      100,
  );
  const featuredAchievement =
    unlockedAchievementRows[0] ?? visibleAchievementRows[0];

  const isBanned =
    !!user?.reviewBannedUntil && new Date(user.reviewBannedUntil) > new Date();
  const bannedUntil = user?.reviewBannedUntil
    ? new Date(user.reviewBannedUntil)
    : null;

  function Badge({
    name,
    color,
    icon,
  }: {
    name: string;
    color: string;
    icon?: React.ReactNode;
  }) {
    return (
      <div
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${color} flex items-center gap-1.5 transition-all hover:scale-105`}
      >
        {icon}
        <span>{name}</span>
      </div>
    );
  }

  function Achievement({
    title,
    description,
    progress,
    icon,
  }: {
    title: string;
    description: string;
    progress: number;
    icon: React.ReactNode;
  }) {
    const percentage = Math.min(Math.floor(progress * 100), 100);
    const isComplete = percentage >= 100;

    return (
      <div
        className={`bg-white/5 p-4 rounded-xl border ${isComplete ? "border-[#e94f37]/40" : "border-white/10"} transition-all hover:scale-105`}
      >
        <div className="flex items-start gap-3 mb-3">
          <div
            className={`w-10 h-10 rounded-lg ${isComplete ? "bg-[#e94f37]" : "bg-white/10"} flex items-center justify-center flex-shrink-0`}
          >
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
        <p className="text-xs mt-2 text-gray-400 font-semibold">
          {percentage}% complete
        </p>
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
        <div
          aria-hidden
          className="pointer-events-none absolute -top-12 -right-12 w-44 h-44 rounded-full bg-[#e94f37]/15 blur-3xl"
        />
        <div className="relative flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#e94f37]/15 border border-[#e94f37]/25 flex items-center justify-center">
            {isTv ? (
              <Tv className="w-7 h-7 text-[#e94f37]" />
            ) : (
              <Film className="w-7 h-7 text-[#e94f37]" />
            )}
          </div>
          <div className="space-y-1.5 max-w-md">
            <h3 className="text-lg sm:text-xl font-bold text-white">
              {heading}
            </h3>
            <p className="text-sm sm:text-base text-white/50 leading-relaxed">
              {sub}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-1">
            {!isTv && (
              <Link
                href="/movies"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#e94f37] hover:bg-[#ff5746] text-white text-sm font-semibold transition"
              >
                <Film className="w-4 h-4" /> Review a movie
              </Link>
            )}
            {!isMovie && (
              <Link
                href="/tv"
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${isTv ? "bg-[#e94f37] hover:bg-[#ff5746] text-white" : "border border-white/15 text-white/80 hover:bg-white/5"}`}
              >
                <Tv className="w-4 h-4" /> Review a series
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black pb-8 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(233,79,55,0.18),transparent_32%),radial-gradient(circle_at_88%_12%,rgba(255,255,255,0.07),transparent_24%),linear-gradient(180deg,#050505_0%,#000_58%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,0.65)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.65)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="relative mx-auto w-full max-w-7xl px-4 py-5 sm:px-8 sm:py-24 lg:px-10">
        <section className="relative mb-5 overflow-hidden border-b border-white/10 pb-6 sm:mb-8 sm:pb-10">
          <div className="pointer-events-none absolute right-0 top-0 hidden h-72 w-72 opacity-20 sm:block">
            <Image
              src={MASCOT_SRC}
              alt=""
              fill
              sizes="288px"
              className="object-contain"
              priority
            />
          </div>

          <div className="relative grid gap-5 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-5">
              <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={() => user?.avatarUrl && setAvatarLightbox(true)}
                className={`relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl bg-zinc-900 shadow-2xl shadow-[#e94f37]/10 ring-2 ring-[#e94f37]/70 sm:h-32 sm:w-32 lg:h-36 lg:w-36${user?.avatarUrl ? " cursor-pointer transition-shadow hover:ring-[#ff8a78]" : ""}`}
              >
                {user?.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt="Profile avatar"
                    fill
                    sizes="128px"
                    className="object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#e94f37] text-4xl font-black text-white sm:text-5xl">
                    {(user?.name || "U")[0]}
                  </div>
                )}
              </motion.div>

              <div className="min-w-0 flex-1 pb-1">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#ff8a78]">
                    <Image
                      src={LOGO_SRC}
                      alt=""
                      width={18}
                      height={18}
                      className="h-4 w-4 object-contain"
                    />
                    Moodies Profile
                  </span>
                  <span className="rounded-lg bg-[#e94f37]/20 px-3 py-1.5 text-xs font-bold uppercase text-[#ff8a78]">
                    {user?.role ?? "user"}
                  </span>
                  {isBanned && (
                    <span className="rounded-lg bg-yellow-500/15 px-3 py-1.5 text-xs font-semibold text-yellow-300">
                      Banned until {bannedUntil?.toLocaleDateString()}
                    </span>
                  )}
                </div>
                <h1 className="break-words text-[2rem] font-black leading-[1.05] tracking-tight sm:text-6xl">
                  {user?.name || user?.username || "Your Profile"}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/55">
                  <span>@{user?.username ?? "user"}</span>
                  <span className="text-white/18">/</span>
                  <span>{profilePersona.title}</span>
                  <span className="text-white/18">/</span>
                  <span>{profileCompletion}% complete</span>
                </div>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/58 sm:mt-4 sm:text-base">
                  A living read of what you save, rate, and return to, tuned for
                  mood-first discovery.
                </p>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur sm:p-5 lg:p-4">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e94f37]/70 to-transparent" />
              <div className="flex items-start gap-3">
                <div className="relative h-16 w-16 flex-shrink-0 rounded-2xl bg-[#e94f37]/10 sm:h-20 sm:w-20">
                  <Image
                    src={MASCOT_SRC}
                    alt="Moodies mascot"
                    fill
                    sizes="80px"
                    className="object-contain p-1"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff8a78]">
                    Moodies read
                  </p>
                  <p className="mt-1 text-lg font-black text-white">
                    {profilePersona.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-white/48">
                    {profilePersona.detail}
                  </p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[#e94f37]"
                      style={{ width: `${profileCompletion}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <button
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#e94f37] text-sm font-semibold text-white transition hover:bg-[#ff5746]"
                  onClick={() => {
                    setProfileName(user?.name ?? user?.username ?? "");
                    setProfileUsername(user?.username ?? "");
                    setProfileError(null);
                    setEditOpen(true);
                  }}
                  title="Edit profile"
                >
                  <Settings className="h-4 w-4" />
                </button>
                <Link
                  href="/settings"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                  title="Settings"
                >
                  <Shield className="h-4 w-4" />
                </Link>
                <button
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/5 text-red-300 transition hover:bg-red-500/10"
                  onClick={async () => {
                    await logout();
                    window.location.href = "/";
                  }}
                  title="Log out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Grid */}
        <div className="mb-5 grid grid-cols-2 gap-2.5 sm:mb-8 sm:gap-3 lg:grid-cols-4">
          <StatCard
            label="Movies"
            value={movieCount}
            icon={<Film className="w-4 h-4 sm:w-5 sm:h-5" />}
          />
          <StatCard
            label="TV Series"
            value={seriesCount}
            icon={<Tv className="w-4 h-4 sm:w-5 sm:h-5" />}
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

        <div className="mb-6 grid gap-3 sm:mb-8 sm:gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff8a78]">
                  Taste insight
                </p>
                <h2 className="mt-2 text-2xl font-black sm:text-3xl">
                  {profilePersona.title}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
                  {profilePersona.detail}
                </p>
              </div>
              <div className="hidden h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-[#e94f37]/15 text-[#ff8a78] sm:flex">
                <Sparkles className="h-6 w-6" />
              </div>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-3 sm:gap-3">
              <InsightTile
                label="Primary signal"
                value={profilePersona.signal}
              />
              <InsightTile
                label="Badges earned"
                value={`${unlockedAchievementRows.length} unlocked`}
              />
              <InsightTile
                label="Privacy visible"
                value={`${visibleDisclosureCount}/${disclosureItems.length} sections`}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-[#ff8a78]" />
                <h2 className="text-lg font-bold">Public profile</h2>
              </div>
              <button
                className="inline-flex h-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-bold text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                onClick={() => {
                  setProfileName(user?.name ?? user?.username ?? "");
                  setProfileUsername(user?.username ?? "");
                  setProfileError(null);
                  setEditOpen(true);
                }}
              >
                <Settings className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </button>
            </div>
            <p className="mt-2 text-sm leading-6 text-white/48">
              {visibleDisclosureCount} of {disclosureItems.length} profile
              sections are visible on your public page.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {disclosureItems.map(([key, label]) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-white/70">
                    {disclosure[key] ? (
                      <Unlock className="h-4 w-4 text-emerald-300" />
                    ) : (
                      <Lock className="h-4 w-4 text-white/35" />
                    )}
                    {label}
                  </span>
                  <span
                    className={`text-[0.65rem] font-bold uppercase tracking-[0.12em] ${disclosure[key] ? "text-emerald-300/75" : "text-white/25"}`}
                  >
                    {disclosure[key] ? "Shown" : "Hidden"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs – comfortable & touch-friendly */}
        <div className="sticky top-2 z-20 mb-5 flex gap-1.5 overflow-x-auto rounded-2xl border border-white/10 bg-zinc-950/90 p-1.5 shadow-xl shadow-black/30 backdrop-blur mobile-native-scroll sm:static sm:mb-8 sm:gap-2 sm:bg-white/[0.035] sm:shadow-none">
          {(["profile", "watchlist", "reviews"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`inline-flex min-h-11 min-w-[7.5rem] flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-xs font-bold transition-all duration-200 sm:min-w-0 sm:px-4 sm:text-sm ${
                tab === t
                  ? "bg-[#e94f37] text-white shadow-lg shadow-[#e94f37]/15"
                  : "text-white/42 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              {t === "profile" && <Sparkles className="h-4 w-4" />}
              {t === "watchlist" && <Bookmark className="h-4 w-4" />}
              {t === "reviews" && <Star className="h-4 w-4" />}
              {t === "profile"
                ? "Overview"
                : t.charAt(0).toUpperCase() + t.slice(1)}
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
              <div className="mb-6 grid gap-3 sm:mb-8 md:grid-cols-3">
                <OverviewCard
                  icon={<Sparkles className="h-5 w-5" />}
                  label="Profile pulse"
                  title={profilePersona.title}
                  detail={profilePersona.signal}
                />
                <OverviewCard
                  icon={<Award className="h-5 w-5" />}
                  label="Featured badge"
                  title={
                    featuredAchievement?.badge?.badgeName ??
                    featuredAchievement?.achievement.title ??
                    "No badge yet"
                  }
                  detail={
                    featuredAchievement?.progress.unlocked
                      ? "Unlocked and public-ready"
                      : "Keep building progress"
                  }
                />
                <OverviewCard
                  icon={<Shield className="h-5 w-5" />}
                  label="Public visibility"
                  title={`${visibleDisclosureCount}/${disclosureItems.length} sections visible`}
                  detail="Change this anytime from edit profile"
                />
              </div>

              {/* Achievements */}
              <div className="mb-7 sm:mb-10">
                <SectionHeading
                  icon={<Award className="h-6 w-6 text-[#e94f37]" />}
                  title="Achievements"
                  caption={`${visibleAchievementRows.length || 3} active goals`}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                  {visibleAchievementRows.length > 0 ? (
                    visibleAchievementRows.map((row) => (
                      <AchievementCard key={row.achievement.key} row={row} />
                    ))
                  ) : (
                    <>
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
                        title="Critic's Choice"
                        description="Write 10 reviews"
                        progress={reviewCount / 10}
                        icon={<Star className="w-4 h-4 sm:w-5 sm:h-5" />}
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Badges */}
              <div className="mb-7 sm:mb-10">
                <SectionHeading
                  icon={<TrendingUp className="h-6 w-6 text-[#e94f37]" />}
                  title="Earned Badges"
                  caption={`${unlockedAchievementRows.length} unlocked`}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {unlockedAchievementRows.length > 0
                    ? unlockedAchievementRows
                        .slice(0, 6)
                        .map((row) => (
                          <RewardBadgeCard
                            key={row.achievement.key}
                            row={row}
                          />
                        ))
                    : earnedBadges.map((badge) => (
                        <Badge
                          key={badge.name}
                          name={badge.name}
                          color={
                            badge.earned
                              ? "bg-[#e94f37]/15 text-[#ff8a78] border border-[#e94f37]/30"
                              : "bg-white/[0.03] text-white/30 border border-white/10"
                          }
                          icon={badge.icon}
                        />
                      ))}
                </div>
              </div>

              {/* Activity Summary */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:rounded-2xl sm:p-6">
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-3 sm:mb-4">
                  Recent Activity
                </h2>
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
                <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
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
        ${
          viewMode === "grid"
            ? "bg-[#e94f37] text-white"
            : "text-gray-400 hover:bg-white/5 hover:text-white"
        }
      `}
                      >
                        <Grid className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setViewMode("list")}
                        className={`
        p-2 rounded-lg transition
        ${
          viewMode === "list"
            ? "bg-[#e94f37] text-white"
            : "text-gray-400 hover:bg-white/5 hover:text-white"
        }
      `}
                      >
                        <List className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Mobile Filter Button */}
                  <div className="flex w-full gap-2 sm:hidden">
                    <button
                      onClick={() => setMobileFilterOpen(true)}
                      className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                    >
                      <Filter className="w-4 h-4" />
                      Filters & Sort
                    </button>
                    <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
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

                <div className="mt-2 flex items-center justify-between text-xs text-gray-400 sm:text-sm">
                  <p>
                    Showing {filteredAndSortedItems.length} of {totalCount}{" "}
                    items
                  </p>
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
                    className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
                  >
                    {loading &&
                      Array.from({ length: 12 }).map((_, i) => (
                        <div
                          key={i}
                          className="aspect-[2/3] rounded-xl sm:rounded-2xl bg-zinc-900 animate-pulse"
                        />
                      ))}

                    {!loading &&
                      filteredAndSortedItems.map((item) => {
                        const title =
                          item.kind === "movie" ? item.title : item.name;
                        const href =
                          item.kind === "movie"
                            ? `/movies/${item.id}`
                            : `/tv/${item.id}`;
                        const poster = item.poster_path
                          ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
                          : "/placeholder-poster.svg";

                        return (
                          <motion.div
                            key={`${item.kind}-${item.id}`}
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            whileHover={{ scale: 1.05, y: -5 }}
                            className="group relative aspect-[2/3] cursor-pointer overflow-hidden rounded-xl bg-zinc-900 shadow-lg transition-shadow hover:shadow-2xl hover:shadow-[#e94f37]/20 sm:rounded-2xl"
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
                                <div className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-black/90 px-1.5 py-1 text-xs font-semibold text-yellow-400 sm:right-3 sm:top-3 sm:gap-1.5 sm:px-2.5 sm:py-1.5">
                                  <Star className="w-3 h-3 fill-yellow-400" />
                                  {item.vote_average.toFixed(1)}
                                </div>
                              )}

                              <div className="absolute left-2 top-2 rounded-lg bg-black/90 px-1.5 py-1 text-xs font-semibold sm:left-3 sm:top-3 sm:px-2.5 sm:py-1.5">
                                {item.kind === "movie" ? (
                                  <Film className="w-3 h-3" />
                                ) : (
                                  <Tv className="w-3 h-3" />
                                )}
                              </div>

                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2.5 sm:p-4">
                                <p className="text-xs sm:text-sm font-bold line-clamp-2 mb-0.5 sm:mb-1">
                                  {title}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {item.kind === "movie"
                                    ? item.release_date?.split("-")[0]
                                    : item.first_air_date?.split("-")[0]}
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
                    {loading &&
                      Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-20 sm:h-24 rounded-xl bg-zinc-900 animate-pulse"
                        />
                      ))}

                    {!loading &&
                      filteredAndSortedItems.map((item) => {
                        const title =
                          item.kind === "movie" ? item.title : item.name;
                        const href =
                          item.kind === "movie"
                            ? `/movies/${item.id}`
                            : `/tv/${item.id}`;
                        const poster = item.poster_path
                          ? `https://image.tmdb.org/t/p/w200${item.poster_path}`
                          : "/placeholder-poster.svg";

                        return (
                          <motion.div
                            key={`${item.kind}-${item.id}`}
                            layout
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.15, ease: "easeOut" }}
                            className="group rounded-xl border border-white/10 bg-white/5 p-3 transition-all hover:bg-white/10 sm:p-4"
                          >
                            <Link
                              href={href}
                              className="flex items-center gap-3 sm:gap-4"
                            >
                              <div className="relative h-[4.75rem] w-12 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-900 sm:h-24 sm:w-16">
                                <Image
                                  src={poster}
                                  alt={title || "Poster"}
                                  fill
                                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                                  className="object-cover"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-sm sm:text-lg mb-1 truncate group-hover:text-[#e94f37] transition">
                                  {title}
                                </h3>
                                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-400">
                                  <span className="flex items-center gap-1">
                                    {item.kind === "movie" ? (
                                      <Film className="w-3 h-3 sm:w-4 sm:h-4" />
                                    ) : (
                                      <Tv className="w-3 h-3 sm:w-4 sm:h-4" />
                                    )}
                                    <span className="hidden sm:inline">
                                      {item.kind === "movie"
                                        ? "Movie"
                                        : "TV Series"}
                                    </span>
                                  </span>
                                  {(item.release_date ||
                                    item.first_air_date) && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                                      {item.kind === "movie"
                                        ? item.release_date?.split("-")[0]
                                        : item.first_air_date?.split("-")[0]}
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
                  <h3 className="text-lg sm:text-xl font-semibold mb-2">
                    No items found
                  </h3>
                  <p className="text-sm sm:text-base text-gray-400 px-4">
                    {searchQuery
                      ? "Try adjusting your search or filters"
                      : "Start adding movies and TV shows to your watchlist"}
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
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-0.5 bg-[#e94f37]" />
                    <span className="text-[0.62rem] font-bold tracking-[0.2em] uppercase text-white/30">
                      Your Activity
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white">
                    My Reviews
                  </h2>
                </div>
                {/* Movie / TV filter tabs */}
                <div className="flex w-full items-center gap-1 overflow-x-auto rounded-xl border border-white/[0.07] bg-white/[0.03] p-1 mobile-native-scroll sm:w-auto sm:flex-shrink-0">
                  {(["all", "MOVIE", "TV"] as const).map((f) => {
                    const label =
                      f === "all"
                        ? "All"
                        : f === "MOVIE"
                          ? "Movies"
                          : "TV Series";
                    const count =
                      f === "all"
                        ? reviews.length
                        : reviews.filter((r) => r.mediaType === f).length;
                    return (
                      <button
                        key={f}
                        onClick={() => {
                          setReviewTypeFilter(f);
                          setReviewsVisible(3);
                        }}
                        className={`min-h-9 flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all sm:flex-none ${
                          reviewTypeFilter === f
                            ? "bg-white/[0.08] text-white"
                            : "text-white/30 hover:text-white/60"
                        }`}
                      >
                        {label}
                        <span
                          className={`ml-1.5 text-[0.55rem] ${reviewTypeFilter === f ? "text-white/40" : "text-white/15"}`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Gradient rule */}
              <div className="mb-5 h-px bg-gradient-to-r from-[rgb(233,79,55)]/30 via-white/[0.06] to-transparent sm:mb-8" />

              {/* Loading skeletons */}
              {reviewsLoading && (
                <div className="space-y-5">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-48 rounded-2xl bg-white/[0.03] animate-pulse border border-white/[0.05]"
                    />
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
                  {filteredMediaGroups
                    .slice(0, reviewsVisible)
                    .map((group, gIdx) => {
                      const rep = group.reviews[0];
                      const isMovie = rep.mediaType === "MOVIE";
                      const href = isMovie
                        ? `/movies/${rep.tmdbId}`
                        : `/tv/${rep.tmdbId}`;
                      const poster = rep.tmdbPoster
                        ? `https://image.tmdb.org/t/p/w92${rep.tmdbPoster}`
                        : null;
                      const visibleCount = cardReviewsVisible[group.key] ?? 1;
                      const visibleReviews = group.reviews.slice(
                        0,
                        visibleCount,
                      );
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
                            const stars = Math.max(
                              0,
                              Math.min(10, review.rating),
                            );
                            const accentHex =
                              stars >= 8
                                ? "#22c55e"
                                : stars >= 6
                                  ? "#e94f37"
                                  : stars >= 4
                                    ? "#f59e0b"
                                    : "#ef4444";
                            return (
                              <div
                                key={review.id}
                                className="mb-2 grid overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.015] transition-all duration-300 hover:border-white/[0.11] hover:bg-white/[0.03] sm:mb-1.5 sm:flex"
                              >
                                {/* Score stripe */}
                                <div
                                  className="flex min-h-14 items-center justify-between gap-2 px-3 py-2 sm:w-[64px] sm:flex-shrink-0 sm:flex-col sm:justify-center sm:gap-1 sm:px-0 sm:py-7"
                                  style={{ background: `${accentHex}12` }}
                                >
                                  <div className="flex items-baseline gap-1 sm:block sm:text-center">
                                    <span
                                      className="text-2xl font-black leading-none"
                                      style={{ color: accentHex }}
                                    >
                                      {stars}
                                    </span>
                                    <span className="text-[0.5rem] font-semibold uppercase tracking-widest text-white/25 sm:block sm:text-[0.44rem]">
                                      / 10
                                    </span>
                                  </div>
                                  {review.moodEmojis?.length > 0 && (
                                    <div className="mt-0.5 flex max-w-[72px] flex-wrap justify-center gap-0.5 sm:max-w-[44px]">
                                      {review.moodEmojis
                                        .slice(0, 2)
                                        .map((e, i) => (
                                          <ReviewMoodIcon key={i} value={e} />
                                        ))}
                                    </div>
                                  )}
                                </div>

                                {/* Poster column */}
                                <Link
                                  href={href}
                                  className="relative hidden w-[72px] flex-shrink-0 overflow-hidden border-l border-white/[0.05] sm:block"
                                >
                                  {poster ? (
                                    <Image
                                      src={poster}
                                      alt=""
                                      fill
                                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                                      className="object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-white/[0.02]">
                                      {isMovie ? (
                                        <Film className="w-3 h-3 text-white/15" />
                                      ) : (
                                        <Tv className="w-3 h-3 text-white/15" />
                                      )}
                                    </div>
                                  )}
                                </Link>

                                {/* Content */}
                                <div className="flex min-w-0 flex-1 flex-col justify-between border-t border-white/[0.05] px-3 py-4 sm:border-l sm:border-t-0 sm:px-5 sm:py-5">
                                  {/* Review text */}
                                  <div className="mb-3 relative">
                                    {/* Opening quote mark */}
                                    <span
                                      className="absolute -top-1 -left-1 text-[1.4rem] font-black leading-none select-none pointer-events-none"
                                      style={{
                                        color: accentHex,
                                        opacity: 0.35,
                                      }}
                                    >
                                      &quot;
                                    </span>
                                    <p className="text-[0.82rem] sm:text-[0.95rem] text-white/80 leading-relaxed line-clamp-4 sm:line-clamp-5 pl-4 font-medium tracking-wide">
                                      {review.content}
                                    </p>
                                  </div>

                                  {/* Attribution row — stacks on mobile */}
                                  <div className="flex flex-col gap-1 border-t border-white/[0.04] pt-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                                    <Link
                                      href={href}
                                      className="flex items-center gap-1.5 group/attr min-w-0"
                                    >
                                      <span
                                        className="text-[0.58rem] font-bold uppercase tracking-[0.12em] flex-shrink-0"
                                        style={{ color: `${accentHex}70` }}
                                      >
                                        {isMovie ? "Movie" : "TV"}
                                      </span>
                                      <span className="text-white/15 text-[0.5rem]">
                                        ·
                                      </span>
                                      <span className="text-[0.85rem] sm:text-[0.95rem] font-semibold text-white/75 group-hover/attr:text-white transition-colors truncate">
                                        {rep.tmdbTitle || `#${rep.tmdbId}`}
                                      </span>
                                      {rep.tmdbYear && (
                                        <span className="text-[0.7rem] text-white/45 flex-shrink-0">
                                          {rep.tmdbYear}
                                        </span>
                                      )}
                                    </Link>

                                    <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">
                                      {review.status === "FLAGGED" && (
                                        <span className="text-[0.48rem] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400/70 border border-yellow-500/15">
                                          flagged
                                        </span>
                                      )}
                                      {group.reviews.length > 1 &&
                                        rIdx === 0 &&
                                        !hasLess && (
                                          <span className="text-[0.55rem] text-white/18 font-medium">
                                            +{group.reviews.length - 1}
                                          </span>
                                        )}
                                      <span className="text-[0.72rem] sm:text-[0.8rem] text-white/55 font-medium tabular-nums">
                                        {new Date(
                                          review.createdAt,
                                        ).toLocaleDateString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                          year: "numeric",
                                        })}
                                        <span className="text-white/30 mx-0.5">
                                          ·
                                        </span>
                                        {new Date(
                                          review.createdAt,
                                        ).toLocaleTimeString("en-US", {
                                          hour: "numeric",
                                          minute: "2-digit",
                                        })}
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
                                    onClick={() =>
                                      setCardReviewsVisible((prev) => ({
                                        ...prev,
                                        [group.key]: Math.min(
                                          visibleCount + 5,
                                          group.reviews.length,
                                        ),
                                      }))
                                    }
                                    className="flex items-center gap-1.5 text-[0.70rem] text-white/25 hover:text-white/55 font-medium transition-colors"
                                  >
                                    <svg
                                      width="10"
                                      height="10"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2.5"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <path d="M6 9l6 6 6-6" />
                                    </svg>
                                    {group.reviews.length - visibleCount <= 5
                                      ? `${group.reviews.length - visibleCount} more`
                                      : "5 more"}
                                  </button>
                                  {group.reviews.length - visibleCount > 5 && (
                                    <button
                                      onClick={() =>
                                        setCardReviewsVisible((prev) => ({
                                          ...prev,
                                          [group.key]: group.reviews.length,
                                        }))
                                      }
                                      className="flex items-center gap-1.5 text-[0.70rem] text-white/18 hover:text-white/45 font-medium transition-colors"
                                    >
                                      Show all {group.reviews.length}
                                    </button>
                                  )}
                                </>
                              )}
                              {hasLess && (
                                <button
                                  onClick={() =>
                                    setCardReviewsVisible((prev) => ({
                                      ...prev,
                                      [group.key]: 1,
                                    }))
                                  }
                                  className="ml-auto flex items-center gap-1.5 text-[0.65rem] text-white/18 hover:text-white/45 font-medium transition-colors"
                                >
                                  <svg
                                    width="10"
                                    height="10"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M18 15l-6-6-6 6" />
                                  </svg>
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
                    <div className="flex flex-wrap items-center gap-2 pt-2 sm:gap-3">
                      {reviewsVisible < filteredMediaGroups.length && (
                        <button
                          onClick={() => setReviewsVisible((v) => v + 3)}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/50 text-sm font-medium hover:bg-white/[0.07] hover:text-white/80 hover:border-white/[0.15] transition-all"
                        >
                          <span>Load more</span>
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </button>
                      )}
                      {reviewsVisible > 3 && (
                        <button
                          onClick={() => setReviewsVisible(3)}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/30 text-sm font-medium hover:bg-white/[0.05] hover:text-white/60 transition-all"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M18 15l-6-6-6 6" />
                          </svg>
                          <span>Collapse</span>
                        </button>
                      )}
                      <span className="text-[0.70rem] text-white/20 font-medium ml-auto">
                        {Math.min(reviewsVisible, filteredMediaGroups.length)}{" "}
                        of {filteredMediaGroups.length} titles
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
              className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/80 p-3 backdrop-blur-sm sm:items-center sm:p-4"
              onClick={() => setMobileFilterOpen(false)}
            >
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                className="max-h-[86svh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-white/10 bg-zinc-900 p-5 mobile-native-scroll sm:rounded-2xl sm:p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold">Filters & Sort</h3>
                  <button
                    onClick={() => setMobileFilterOpen(false)}
                    className="p-2 hover:bg-white/5 rounded-lg transition"
                  >
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
                        onChange={(e) =>
                          setFilterType(
                            e.target.value as "all" | "movie" | "tv",
                          )
                        }
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
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M6 9l6 6 6-6"
                            stroke="currentColor"
                            strokeWidth="2"
                          />
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
                        onChange={(e) =>
                          setSortBy(
                            e.target.value as "dateAdded" | "rating" | "title",
                          )
                        }
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
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M6 9l6 6 6-6"
                            stroke="currentColor"
                            strokeWidth="2"
                          />
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
              className="fixed inset-0 z-[999] flex items-end justify-center bg-black/85 p-3 backdrop-blur-md sm:items-center sm:p-6"
              onClick={() => {
                if (!profileSaving) {
                  setAvatarPreview(null);
                  setEditOpen(false);
                }
              }}
            >
              <motion.div
                initial={{ y: 28, opacity: 0, scale: 0.98 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 28, opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl shadow-black/60 sm:max-h-[calc(100dvh-3rem)] sm:rounded-2xl sm:p-8"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 flex-shrink-0">
                      <Image
                        src={MASCOT_SRC}
                        alt="Moodies mascot"
                        fill
                        sizes="48px"
                        className="object-contain"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff8a78]">
                        Profile tune-up
                      </p>
                      <h2 className="text-xl sm:text-2xl font-black">
                        Edit profile
                      </h2>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!profileSaving) {
                        setAvatarPreview(null);
                        setEditOpen(false);
                      }
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/60 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
                    disabled={profileSaving}
                    aria-label="Close edit profile"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-4 sm:space-y-5">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <label className="block text-sm font-semibold mb-3 text-white/80">
                      Profile picture
                    </label>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        className="group relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl bg-zinc-900 ring-2 ring-[#e94f37]/50 transition hover:ring-[#ff8a78]"
                      >
                        {avatarPreview ? (
                          <img
                            src={avatarPreview}
                            alt="preview"
                            className="w-full h-full object-cover"
                          />
                        ) : user?.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt="avatar"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-white/60">
                            {(user?.name || "U")[0]}
                          </div>
                        )}
                        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/65 py-2 text-xs font-bold text-white opacity-0 transition group-hover:opacity-100">
                          <Camera className="h-3.5 w-3.5" />
                          Change
                        </span>
                      </button>
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
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.055] px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/[0.09] hover:text-white"
                        >
                          <Camera className="h-4 w-4" />
                          {avatarPreview ? "Choose another" : "Upload avatar"}
                        </button>
                        {avatarPreview && (
                          <button
                            type="button"
                            onClick={() => setAvatarPreview(null)}
                            className="px-4 py-2 text-left text-sm font-semibold text-red-300 transition hover:text-red-200"
                          >
                            Remove preview
                          </button>
                        )}
                        <p className="max-w-xs text-xs leading-5 text-white/35">
                          Square images work best. Large uploads are resized
                          before saving.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center gap-2 text-sm font-semibold text-white/80">
                        <UserRound className="h-4 w-4 text-[#ff8a78]" />
                        Display name
                      </label>
                      <span
                        className={`text-xs tabular-nums ${profileName.length > 48 ? "text-red-400" : "text-white/35"}`}
                      >
                        {profileName.length}/50
                      </span>
                    </div>
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) =>
                        setProfileName(e.target.value.slice(0, 50))
                      }
                      maxLength={50}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#e94f37]/60 focus:ring-2 focus:ring-[#e94f37]/25 sm:text-base"
                      placeholder="Enter your name"
                    />
                    <p className="text-xs text-white/35 mt-1">
                      2-50 characters
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center gap-2 text-sm font-semibold text-white/80">
                        <Sparkles className="h-4 w-4 text-[#ff8a78]" />
                        Username
                      </label>
                      <span
                        className={`text-xs tabular-nums ${profileUsername.length > 18 ? "text-red-400" : "text-white/35"}`}
                      >
                        {profileUsername.length}/20
                      </span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-white/35">
                        @
                      </span>
                      <input
                        type="text"
                        value={profileUsername}
                        onChange={(e) =>
                          setProfileUsername(
                            e.target.value
                              .replace(/^@/, "")
                              .replace(/[^a-zA-Z0-9_]/g, "")
                              .slice(0, 20),
                          )
                        }
                        maxLength={20}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.055] py-3 pl-8 pr-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#e94f37]/60 focus:ring-2 focus:ring-[#e94f37]/25 sm:text-base"
                        placeholder="username"
                      />
                    </div>
                    <p className="text-xs text-white/35 mt-1">
                      3-20 characters, letters, numbers, underscores only
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-white/80">
                      <Mail className="h-4 w-4 text-[#ff8a78]" />
                      Email
                    </label>
                    <input
                      type="email"
                      value={user?.email ?? ""}
                      readOnly
                      className="w-full cursor-not-allowed rounded-xl border border-white/5 bg-white/[0.025] px-4 py-3 text-sm text-white/35 outline-none sm:text-base"
                    />
                    <p className="text-xs text-white/30 mt-1">
                      Email cannot be changed
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-[#ff8a78]" />
                        <h3 className="text-sm font-bold text-white">
                          Public visibility
                        </h3>
                      </div>
                      <span className="text-xs font-medium text-white/35">
                        Your profile
                      </span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(
                        [
                          ["profileInfo", "Profile info"],
                          ["watchlist", "Watchlist"],
                          ["liked", "Liked titles"],
                          ["reviews", "Reviews"],
                          ["badges", "Badges"],
                          ["recentActivity", "Recent activity"],
                        ] as const
                      ).map(([key, label]) => (
                        <label
                          key={key}
                          className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5"
                        >
                          <span className="flex items-center gap-2 text-sm font-semibold text-white/75">
                            {disclosure[key] ? (
                              <Unlock className="h-4 w-4 text-emerald-300" />
                            ) : (
                              <Lock className="h-4 w-4 text-white/35" />
                            )}
                            {label}
                          </span>
                          <input
                            type="checkbox"
                            checked={disclosure[key]}
                            onChange={() =>
                              setDisclosure((prev) => ({
                                ...prev,
                                [key]: !prev[key],
                              }))
                            }
                            className="h-4 w-4 accent-[#e94f37]"
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  {profileError && (
                    <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
                      {profileError}
                    </p>
                  )}
                </div>

                <div className="mt-7 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    className="order-2 w-full rounded-xl border border-white/10 px-5 py-3 font-semibold text-white/70 transition hover:bg-white/5 hover:text-white disabled:opacity-50 sm:order-1 sm:w-auto"
                    onClick={() => {
                      setAvatarPreview(null);
                      setEditOpen(false);
                    }}
                    disabled={profileSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="order-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#e94f37] px-5 py-3 font-semibold text-white transition hover:bg-[#ff5746] disabled:cursor-not-allowed disabled:opacity-50 sm:order-2 sm:w-auto"
                    onClick={saveProfile}
                    disabled={profileSaving}
                  >
                    <Save className="h-4 w-4" />
                    {profileSaving ? "Saving..." : "Save changes"}
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
function resolveBadgeIcon(icon?: string) {
  const className = "w-4 h-4";
  if (
    icon?.toLowerCase().includes("tv") ||
    icon?.toLowerCase().includes("monitor")
  )
    return <Tv className={className} />;
  if (
    icon?.toLowerCase().includes("film") ||
    icon?.toLowerCase().includes("ticket")
  )
    return <Film className={className} />;
  if (icon?.toLowerCase().includes("heart"))
    return <Heart className={className} />;
  if (
    icon?.toLowerCase().includes("bookmark") ||
    icon?.toLowerCase().includes("library")
  )
    return <Bookmark className={className} />;
  if (icon?.toLowerCase().includes("calendar"))
    return <Calendar className={className} />;
  if (
    icon?.toLowerCase().includes("crown") ||
    icon?.toLowerCase().includes("trophy")
  )
    return <Award className={className} />;
  if (icon?.toLowerCase().includes("search"))
    return <Search className={className} />;
  return <Sparkles className={className} />;
}

function InsightTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-white/30">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-white/80">{value}</p>
    </div>
  );
}

function OverviewCard({
  icon,
  label,
  title,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition hover:border-[#e94f37]/30 hover:bg-white/[0.055]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:via-[#e94f37]/60" />
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#e94f37]/14 text-[#ff8a78]">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-white/32">
            {label}
          </p>
          <h3 className="mt-1 truncate text-base font-black text-white">
            {title}
          </h3>
          <p className="mt-1 text-xs leading-5 text-white/45">{detail}</p>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({
  icon,
  title,
  caption,
}: {
  icon: React.ReactNode;
  title: string;
  caption: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 sm:mb-6">
      <div className="flex items-center gap-3">
        {icon}
        <h2 className="text-xl font-black sm:text-2xl md:text-3xl">{title}</h2>
      </div>
      <p className="hidden text-xs font-bold uppercase tracking-[0.16em] text-white/28 sm:block">
        {caption}
      </p>
    </div>
  );
}

function AchievementCard({ row }: { row: UserAchievementView }) {
  const percent = Math.min(Math.max(row.progress.completionPercentage, 0), 100);
  const required = row.achievement.requiredCount ?? 1;
  const unlocked = row.progress.unlocked;
  const badgeName = row.badge?.badgeName ?? row.achievement.title;

  return (
    <div
      className={`rounded-2xl border p-4 transition hover:-translate-y-0.5 ${unlocked ? "border-[#e94f37]/35 bg-[#e94f37]/10" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.06]"}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${unlocked ? "bg-[#e94f37] text-white" : "bg-white/10 text-white/45"}`}
        >
          {resolveBadgeIcon(row.badge?.icon)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-white">{row.achievement.title}</p>
            <span className="rounded-md border border-white/10 px-1.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-white/40">
              {row.achievement.category}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-white/48">
            {unlocked
              ? row.achievement.reasoningTemplate
              : row.achievement.lockedHint}
          </p>
        </div>
      </div>
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-semibold text-white/45">{badgeName}</span>
          <span className="tabular-nums text-white/45">
            {row.progress.currentProgress}/{required}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[#e94f37]"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-white/35">{percent}% complete</p>
      </div>
    </div>
  );
}

function RewardBadgeCard({ row }: { row: UserAchievementView }) {
  const accent = row.badge?.colorTheme?.accent ?? "#e94f37";
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="absolute -right-6 -top-6 h-24 w-24 opacity-20">
        <Image
          src={MASCOT_SRC}
          alt=""
          fill
          sizes="96px"
          className="object-contain"
        />
      </div>
      <div className="relative flex items-start gap-3">
        <div
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-white"
          style={{ backgroundColor: accent }}
        >
          {resolveBadgeIcon(row.badge?.icon)}
        </div>
        <div className="min-w-0">
          <p className="font-black text-white">
            {row.badge?.badgeName ?? row.achievement.title}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-white/35">
            {row.badge?.rarity ?? "Common"}
          </p>
        </div>
      </div>
      <p className="relative mt-3 text-xs leading-5 text-white/55">
        {row.achievement.reasoningTemplate}
      </p>
      {row.progress.unlockedAt && (
        <p className="relative mt-3 text-xs text-white/35">
          Earned {new Date(row.progress.unlockedAt).toLocaleDateString()}
        </p>
      )}
      <p className="relative mt-2 text-xs text-[#ff8a78]">
        {row.badge?.mascotMood}: {row.badge?.mascotMotion}
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  trend,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.035] p-3 transition-all hover:-translate-y-0.5 hover:border-[#e94f37]/25 hover:bg-white/[0.055] sm:rounded-2xl sm:p-5">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="flex items-center justify-between">
        {icon && (
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-[#e94f37]/12 text-[#ff8a78] flex items-center justify-center">
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
      <div className="mt-3">
        <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-0.5 sm:mb-1">
          {label}
        </p>
        <p className="text-2xl sm:text-3xl font-black">{value}</p>
      </div>
    </div>
  );
}

function ActivityItem({
  icon,
  text,
  time,
}: {
  icon: React.ReactNode;
  text: string;
  time: string;
}) {
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
