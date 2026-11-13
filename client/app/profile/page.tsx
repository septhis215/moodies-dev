"use client";
import { sessionFetch } from "@/lib/auth/session";
import { handleAppError } from "@/lib/errors";

import { tmdbImage } from "@/lib/tmdb";
import AchievementCollection from "@/components/achievements/AchievementCollection";
import useAchievements from "@/hooks/useAchievements";
import React, {
  useEffect,
  useLayoutEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
} from "react";
import PageSkeleton from "@/components/loading/PageSkeleton";
import Link from "next/link";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import {
  Film,
  Tv,
  Bookmark,
  Pencil,
  LogOut,
  Star,
  TrendingUp,
  Search,
  Filter,
  Grid,
  List,
  X,
  Sparkles,
  Shield,
  Lock,
  Unlock,
  Camera,
  Mail,
  UserRound,
  Save,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/app/context/AuthProvider";
import CustomSelect from "@/components/ui/custom-select";
import { fetchMediaSummary, type MediaSummary } from "@/lib/mediaApi";
import { BadgeMascot } from "@/components/ui/BadgeMascot";
import { MediaCard, MediaCardSkeleton } from "@/components/ui/MediaCard";
import RatingBadge from "@/components/ui/rating-badge";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api";
const MASCOT_SRC = "/images/moodies-mascot.png";
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
    return <span className="text-lg leading-none">{trimmedValue}</span>;
  }

  return (
    <span
      title={label}
      className="inline-flex size-10 shrink-0 items-center justify-center sm:size-12"
    >
      <Image
        src={trimmedValue}
        alt={label}
        width={48}
        height={48}
        className="size-full object-contain"
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
  reviewWarningScore?: number | null;
  reviewBannedUntil?: string | null;
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
  const {
    user: decodedUser,
    isAuthenticated,
    loading: authLoading,
    logout,
  } = useAuth();

  const [profile, setProfile] = useState<ServerUser | null>(null);
  const [watchlist, setWatchlist] = useState<Watchlist | null>(null);
  const [loadedWatchlist, setLoadedWatchlist] = useState<Watchlist | null>(null);
  const [tmdbItems, setTmdbItems] = useState<MediaSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"profile" | "watchlist" | "reviews">(
    "profile",
  );
  const [editOpen, setEditOpen] = useState(false);
  const editDialogRef = useRef<HTMLDialogElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "movie" | "tv">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"dateAdded" | "rating" | "title">(
    "dateAdded",
  );
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const achievementState = useAchievements();
  const achievements = achievementState.data?.achievements || [];
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

  useEffect(() => {
    setProfile(null);
    setWatchlist(null);
    setReviews([]);
    setEditOpen(false);
    setAvatarPreview(null);
  }, [decodedUser?.id]);

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
          ? sessionFetch(`${API_BASE}/auth/me/profile`, {
              method: "PATCH",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(body),
            })
          : Promise.resolve(null),
        avatarPreview
          ? sessionFetch(`${API_BASE}/auth/me/avatar`, {
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
        const res = await sessionFetch(`${API_BASE}/reviews/me?limit=200`, {
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
            try {
              const tmdb = await fetchMediaSummary(kind, r.tmdbId);
              return {
                ...r,
                tmdbTitle: tmdb?.title,
                tmdbPoster: tmdb?.poster_path ?? null,
                tmdbYear: (tmdb?.release_date ?? tmdb?.first_air_date)?.split("-")[0],
              };
            } catch {
              return r;
            }
          }),
        );
        if (alive) setReviews(enriched);
      } catch (error) {
        if (alive) handleAppError(error, { toastKey: "profile-reviews-error" });
      } finally {
        if (alive) setReviewsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [tab, isAuthenticated, decodedUser?.id]);

  /* ---------------- Fetch profile + watchlist ---------------- */
  useEffect(() => {
    if (!isAuthenticated) return;
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const mePromise = sessionFetch(`${API_BASE}/auth/me`, {
          credentials: "include",
          cache: "no-store",
        });
        const watchlistPromise = sessionFetch(`${API_BASE}/watchlist`, {
          credentials: "include",
          cache: "no-store",
        });
        const [meRes, wlRes] = await Promise.all([mePromise, watchlistPromise]);

        if (!alive) return;
        if (meRes.ok) {
          const me = await meRes.json();
          setProfile(me);
          if (me.disclosure) {
            setDisclosure((prev) => ({ ...prev, ...me.disclosure }));
          }
        }

        if (!alive) return;
        if (wlRes.ok) setWatchlist(await wlRes.json());
      } catch (error) {
        if (alive) handleAppError(error, { toastKey: "profile-session-error" });
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isAuthenticated, decodedUser?.id]);

  /* ---------------- Fetch TMDB details ---------------- */

  useEffect(() => {
    let alive = true;
    (async () => {
      const allIds = [
        ...(watchlist?.movieId ?? []).map((id) => ({ kind: "movie" as const, id })),
        ...(watchlist?.seriesId ?? []).map((id) => ({ kind: "tv" as const, id })),
      ];
      const promises = allIds.map(({ kind, id }) => fetchMediaSummary(kind, id));
      const results = await Promise.all(promises);
      if (!alive) return;
      setTmdbItems(results.filter((item): item is MediaSummary => item !== null));
      setLoadedWatchlist(watchlist);
    })();

    return () => {
      alive = false;
    };
  }, [watchlist]);

  const watchlistLoading = loading || loadedWatchlist !== watchlist;

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
        const title = item.title;
        return title.toLowerCase().includes(searchQuery.toLowerCase());
      });
    }

    items.sort((a, b) => {
      if (sortBy === "title") {
        return a.title.localeCompare(b.title);
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

  const unlockedAchievementRows = achievements.filter((row) => row.progress.unlocked);
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
  const isBanned =
    !!user?.reviewBannedUntil && new Date(user.reviewBannedUntil) > new Date();
  const bannedUntil = user?.reviewBannedUntil
    ? new Date(user.reviewBannedUntil)
    : null;

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
      <div className="ui-panel flex flex-col items-center justify-center gap-2 px-5 py-6 text-center sm:flex-row sm:gap-8 sm:px-8 sm:text-left">
        <BadgeMascot name="conversation-starter" className="size-36 shrink-0 sm:size-48" sizes="(max-width: 639px) 144px, 192px" />
        <div className="max-w-md space-y-4">
          <div className="space-y-1.5">
            <h3 className="text-xl font-bold leading-tight text-[var(--ink)]">
              {heading}
            </h3>
            <p className="text-sm leading-6 text-[var(--ink-muted)]">
              {sub}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
            {!isTv && (
              <Link
                href="/movies"
                className="ui-primary-action inline-flex items-center gap-2"
              >
                <Film className="w-4 h-4" /> Review a movie
              </Link>
            )}
            {!isMovie && (
              <Link
                href="/tv"
                className={isTv ? "ui-primary-action inline-flex items-center gap-2" : "ui-secondary-action inline-flex items-center gap-2"}
              >
                <Tv className="w-4 h-4" /> Review a series
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  useLayoutEffect(() => {
    const dialog = editDialogRef.current;
    if (!editOpen || !dialog) return;

    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [editOpen, authLoading, isAuthenticated]);

  if (authLoading) {
    return <PageSkeleton variant="profile" />;
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[var(--surface-0)] text-[var(--ink)]">
        <div className="ui-shell flex min-h-[72vh] items-center justify-center py-12 text-center">
          <section className="max-w-md" aria-labelledby="profile-sign-in-title">
            <div className="relative mx-auto h-20 w-20">
              <Image
                src={MASCOT_SRC}
                alt=""
                fill
                sizes="80px"
                className="object-contain"
                priority
              />
            </div>
            <p className="ui-kicker mt-5">Your Moodies profile</p>
            <h1
              id="profile-sign-in-title"
              className="mt-3 text-4xl font-bold leading-none text-[var(--ink)] sm:text-5xl"
            >
              Your taste deserves a home
            </h1>
            <p className="mt-4 text-sm leading-6 text-[var(--ink-muted)]">
              Sign in to see your watchlist, reviews, achievements, and the
              personality your picks are building.
            </p>
            <Link href="/auth/login" className="ui-primary-action mt-6 inline-flex">
              Sign in to Moodies
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--surface-0)] bg-[radial-gradient(circle_at_12%_0%,rgba(233,79,55,0.12),transparent_26rem)] pb-14 text-[var(--ink)]">
      <div className="ui-shell py-5 sm:py-10 lg:pt-[calc(3rem+6rem)]">
        <section className="relative mb-5 overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-1)] p-4 shadow-2xl shadow-black/10 sm:mb-6 sm:p-7 lg:p-8" aria-labelledby="profile-heading">
          <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[var(--brand-coral)]/10 blur-3xl" />
          <div className="relative flex items-start gap-4 sm:items-center sm:gap-6">
            <div className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => user?.avatarUrl && setAvatarLightbox(true)}
                aria-label={user?.avatarUrl ? "View profile avatar" : undefined}
                disabled={!user?.avatarUrl}
                className="relative h-[4.75rem] w-[4.75rem] overflow-hidden rounded-2xl bg-[var(--surface-2)] ring-1 ring-[var(--surface-border)] transition-[box-shadow,transform] hover:scale-[1.02] hover:ring-[var(--brand-coral)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)] disabled:cursor-default sm:h-28 sm:w-28"
              >
                {user?.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt="Profile avatar"
                    fill
                    sizes="(max-width: 640px) 72px, 112px"
                    className="object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[var(--brand-coral)] text-3xl font-extrabold text-white sm:text-5xl">
                    {(user?.name || "U")[0]}
                  </div>
                )}
              </button>
              <span className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border-4 border-[var(--surface-1)] bg-[var(--brand-coral)] text-xs font-extrabold text-white shadow-lg">
                {profileCompletion}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="ui-kicker">{profilePersona.title}</p>
                {isBanned && (
                  <span className="text-xs font-semibold text-[var(--brand-gold)]">
                    Banned until {bannedUntil?.toLocaleDateString()}
                  </span>
                )}
              </div>
              <h1 id="profile-heading" className="mt-2 break-words text-4xl font-bold leading-none text-[var(--ink)] sm:text-5xl lg:text-6xl">
                {user?.name || user?.username || "Your Profile"}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--ink-muted)]">
                <span>@{user?.username ?? "user"}</span>
                <span aria-hidden="true">·</span>
                <span>{profileCompletion}% complete</span>
              </div>
            </div>
          </div>

          <div className="relative mt-6 grid gap-4 border-t border-[var(--surface-border)] pt-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6">
            <div className="flex min-w-0 items-center gap-3 rounded-xl bg-[var(--surface-2)]/70 p-3.5 sm:max-w-2xl">
              <div className="relative h-12 w-12 flex-shrink-0">
                <Image src={MASCOT_SRC} alt="" fill sizes="44px" className="object-contain" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-5 text-[var(--ink)]">
                  {profilePersona.detail}
                </p>
                <p className="mt-1 text-xs font-semibold text-[var(--brand-coral-strong)]">
                  {profilePersona.signal}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <button
                className="ui-primary-action inline-flex min-h-11 items-center gap-2"
                onClick={() => {
                  setProfileName(user?.name ?? user?.username ?? "");
                  setProfileUsername(user?.username ?? "");
                  setProfileError(null);
                  setEditOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
                Edit profile
              </button>
              {user?.id && (
                <Link
                  href={`/profile/${user.id}`}
                  className="ui-secondary-action inline-flex min-h-11 items-center"
                >
                  View public profile
                </Link>
              )}
              <button
                className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-[var(--ink-muted)] transition-colors hover:bg-white/5 hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)]"
                onClick={async () => {
                  try {
                    await logout();
                    window.location.href = "/";
                  } catch { /* AuthProvider displays the recoverable logout error. */ }
                }}
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </div>
          </div>
        </section>

        <section
          aria-label="Profile statistics"
          className="mb-5 grid grid-cols-2 gap-3 sm:mb-6 lg:grid-cols-4"
        >
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
            label="Avg TMDB score"
            value={averageRating.toFixed(1)}
            icon={<Star className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />}
          />
        </section>

        <div className="mb-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-1)] p-4 sm:p-6" aria-labelledby="taste-insight-title">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="ui-kicker">
                  Taste insight
                </p>
                <h2 id="taste-insight-title" className="mt-2 text-3xl font-bold leading-none sm:text-4xl">
                  What your picks say
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
                  A concise read based on the collection and reviews you have actually added.
                </p>
              </div>
              <div className="hidden h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--brand-coral)]/10 text-[var(--brand-coral-strong)] sm:flex">
                <Sparkles className="h-6 w-6" />
              </div>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-3">
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
          </section>

          <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-1)] p-4 sm:p-6" aria-labelledby="public-profile-title">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-[var(--brand-coral-strong)]" />
                <h2 id="public-profile-title" className="text-xl font-bold">Public profile</h2>
              </div>
              <button
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--surface-border)] bg-[var(--surface-2)] px-3 text-sm font-semibold text-[var(--ink-muted)] transition-colors hover:border-[var(--brand-coral)] hover:text-[var(--ink)]"
                onClick={() => {
                  setProfileName(user?.name ?? user?.username ?? "");
                  setProfileUsername(user?.username ?? "");
                  setProfileError(null);
                  setEditOpen(true);
                }}
              >
                <Pencil className="mr-1.5 h-4 w-4" />
                Edit
              </button>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
              {visibleDisclosureCount} of {disclosureItems.length} profile
              sections are visible on your public page.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {disclosureItems.map(([key, label]) => (
                <div
                  key={key}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-2)]/60 px-3 py-2.5"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                    {disclosure[key] ? (
                      <Unlock className="h-4 w-4 text-emerald-300" />
                    ) : (
                      <Lock className="h-4 w-4 text-[var(--ink-muted)]" />
                    )}
                    {label}
                  </span>
                  <span
                    className={`text-xs font-bold uppercase tracking-[0.12em] ${disclosure[key] ? "text-emerald-300" : "text-[var(--ink-muted)]"}`}
                  >
                    {disclosure[key] ? "Shown" : "Hidden"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="sticky top-2 z-20 mb-6 flex overflow-x-auto rounded-xl border border-[var(--surface-border)] bg-[var(--surface-0)]/95 p-1.5 shadow-xl shadow-black/15 backdrop-blur-xl mobile-native-scroll sm:static sm:mb-8 sm:w-fit sm:min-w-[32rem]">
          {(["profile", "watchlist", "reviews"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative inline-flex min-h-11 min-w-28 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition-all ${
                tab === t
                  ? "bg-[var(--brand-coral)] text-white shadow-lg shadow-[var(--brand-coral)]/15"
                  : "text-[var(--ink-muted)] hover:bg-white/5 hover:text-[var(--ink)]"
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

        <div>
          {tab === "profile" && (
            <div>
              <AchievementCollection state={achievementState} compact />

            </div>
          )}

          {tab === "watchlist" && (
            <div>
              <section className="mb-5 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-1)] p-3 sm:mb-6 sm:p-4" aria-label="Watchlist controls">
                <div className="mb-3 flex items-end justify-between gap-4 px-1">
                  <div>
                    <p className="ui-kicker">Saved for later</p>
                    <h2 className="mt-1 text-2xl font-bold text-[var(--ink)] sm:text-3xl">Your watchlist</h2>
                  </div>
                  <p className="hidden text-sm text-[var(--ink-muted)] sm:block">
                    {filteredAndSortedItems.length} of {totalCount} titles
                  </p>
                </div>
                <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)] sm:left-4 sm:h-5 sm:w-5" />
                    <input
                      type="text"
                      placeholder="Search your watchlist..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="min-h-12 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface-2)] py-2.5 pl-10 pr-4 text-sm text-[var(--ink)] outline-none transition placeholder:text-[var(--ink-muted)] focus:border-[var(--brand-coral)] focus:ring-2 focus:ring-[var(--brand-coral)]/20 sm:pl-12 sm:text-base"
                    />
                  </div>

                  {/* Desktop Filters inline */}
                  <div className="hidden items-center gap-2 sm:flex">
                    <CustomSelect
                      label="Filter by type"
                      widthClass="w-36"
                      value={filterType}
                      onChange={setFilterType}
                      options={[
                        { label: "All Types", value: "all" },
                        { label: "Movies", value: "movie" },
                        { label: "TV Series", value: "tv" },
                      ]}
                    />

                    <CustomSelect
                      label="Sort by"
                      widthClass="w-36"
                      value={sortBy}
                      onChange={setSortBy}
                      options={[
                        { label: "Date Added", value: "dateAdded" },
                        { label: "Rating", value: "rating" },
                        { label: "Title", value: "title" },
                      ]}
                    />

                    {/* View toggle */}
                    <div className="flex items-center gap-1" role="group" aria-label="Watchlist layout">
                      <button
                        onClick={() => setViewMode("grid")}
                        aria-label="Grid view"
                        aria-pressed={viewMode === "grid"}
                        className="ui-filter-chip size-11 p-0"
                      >
                        <Grid className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setViewMode("list")}
                        aria-label="List view"
                        aria-pressed={viewMode === "list"}
                        className="ui-filter-chip size-11 p-0"
                      >
                        <List className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Mobile Filter Button */}
                  <div className="flex w-full gap-2 sm:hidden">
                    <button
                      onClick={() => setMobileFilterOpen(true)}
                      className="ui-secondary-action flex-1"
                    >
                      <Filter className="w-4 h-4" />
                      Filters & Sort
                    </button>
                    <div className="flex gap-1" role="group" aria-label="Watchlist layout">
                      <button
                        onClick={() => setViewMode("grid")}
                        aria-label="Grid view"
                        aria-pressed={viewMode === "grid"}
                        className="ui-filter-chip size-11 p-0"
                      >
                        <Grid className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewMode("list")}
                        aria-label="List view"
                        aria-pressed={viewMode === "list"}
                        className="ui-filter-chip size-11 p-0"
                      >
                        <List className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between px-1 text-xs text-[var(--ink-muted)] sm:hidden">
                  <p>
                    Showing {filteredAndSortedItems.length} of {totalCount}{" "}
                    items
                  </p>
                </div>
              </section>

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
                    {watchlistLoading
                      ? Array.from({ length: 12 }, (_, i) => <MediaCardSkeleton key={i} />)
                      : filteredAndSortedItems.map((item) => (
                          <MediaCard key={item.kind + ":" + item.id} item={item} type={item.kind} />
                        ))}
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
                    {watchlistLoading &&
                      Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-20 bg-[var(--surface-2)] moodies-skeleton sm:h-24"
                        />
                      ))}

                    {!watchlistLoading &&
                      filteredAndSortedItems.map((item) => {
                        const title = item.title;
                        const href =
                          item.kind === "movie"
                            ? `/movies/${item.id}`
                            : `/tv/${item.id}`;
                        const poster = item.poster_path
                          ? tmdbImage(item.poster_path, "w200")
                          : "/placeholder-poster.svg";

                        return (
                          <motion.div
                            key={`${item.kind}-${item.id}`}
                            layout
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.15, ease: "easeOut" }}
                            className="ui-panel group p-3 transition-colors hover:border-[var(--brand-coral)]/50 hover:bg-[var(--surface-2)] sm:p-4"
                          >
                            <Link
                              href={href}
                              className="ui-card-link flex items-center gap-3 sm:gap-4"
                            >
                              <div className="ui-media-artwork ui-poster w-12 shrink-0 sm:w-16">
                                <Image
                                  src={poster}
                                  alt=""
                                  fill
                                  sizes="(max-width: 639px) 48px, 64px"
                                  className="object-cover"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="mb-1 truncate text-sm font-semibold transition group-hover:text-[var(--brand-coral-strong)] sm:text-lg">
                                  {title}
                                </h3>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--ink-muted)] sm:gap-3 sm:text-sm">
                                  <span>{item.kind === "movie" ? "Movie" : "Series"} · {(item.release_date || item.first_air_date)?.slice(0, 4) || "Date TBA"}</span>
                                  <RatingBadge rating={item.vote_average} variant="minimal" />
                                </div>
                              </div>
                            </Link>
                          </motion.div>
                        );
                      })}
                  </motion.div>
                )}
              </AnimatePresence>

              {!watchlistLoading && filteredAndSortedItems.length === 0 && (
                <div className="text-center py-12 sm:py-16">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <Bookmark className="h-8 w-8 text-[var(--ink-muted)] sm:h-10 sm:w-10" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold mb-2">
                    No items found
                  </h3>
                  <p className="px-4 text-sm text-[var(--ink-muted)] sm:text-base">
                    {searchQuery
                      ? "Try adjusting your search or filters"
                      : "Start adding movies and TV shows to your watchlist"}
                  </p>
                </div>
              )}
            </div>
          )}

          {tab === "reviews" && (
            <div>
              {/* Header row */}
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-0.5 w-6 bg-[var(--brand-coral)]" />
                    <span className="ui-kicker">
                      Your Activity
                    </span>
                  </div>
                  <h2 className="text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl">
                    My Reviews
                  </h2>
                </div>
                {/* Movie / TV filter tabs */}
                <div role="group" aria-label="Filter your reviews" className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
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
                        type="button"
                        aria-pressed={reviewTypeFilter === f}
                        onClick={() => {
                          setReviewTypeFilter(f);
                          setReviewsVisible(3);
                        }}
                        className="ui-filter-chip flex-1 whitespace-nowrap sm:flex-none"
                      >
                        {label}
                        <span
                          className="tabular-nums text-[var(--ink-muted)]"
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Gradient rule */}
              <div className="mb-5 h-px bg-[var(--surface-border)] sm:mb-8" />

              {/* Loading skeletons */}
              {reviewsLoading && (
                <div className="space-y-5">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-48 rounded-2xl bg-white/[0.03] moodies-skeleton border border-white/[0.05]"
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
                        ? tmdbImage(rep.tmdbPoster, "w92")
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
                                className="ui-panel mb-2 grid overflow-hidden sm:mb-1.5 sm:flex"
                              >
                                {/* Score stripe */}
                                <div
                                  className="flex min-h-14 items-center justify-between gap-2 px-3 py-2 sm:w-24 sm:shrink-0 sm:flex-col sm:justify-center sm:gap-2 sm:px-2 sm:py-4"
                                  style={{ background: `${accentHex}12` }}
                                >
                                  <div className="flex items-baseline gap-1 sm:block sm:text-center">
                                    <span
                                      className="text-2xl font-bold leading-none"
                                      style={{ color: accentHex }}
                                    >
                                      {stars}
                                    </span>
                                    <span className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-muted)] sm:block">
                                      / 10
                                    </span>
                                  </div>
                                  {review.moodEmojis?.length > 0 && (
                                    <div className="flex shrink-0 items-center justify-center gap-1 sm:flex-wrap">
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
                                  aria-label={rep.tmdbTitle || "View title #" + rep.tmdbId}
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
                                      className="pointer-events-none absolute -left-1 -top-1 select-none text-2xl font-bold leading-none"
                                      style={{
                                        color: accentHex,
                                        opacity: 0.35,
                                      }}
                                    >
                                      &quot;
                                    </span>
                                    <p className="line-clamp-4 pl-4 text-sm font-medium leading-relaxed text-white/80 sm:line-clamp-5 sm:text-base">
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
                                        className="flex-shrink-0 text-xs font-bold uppercase tracking-[0.12em]"
                                        style={{ color: `${accentHex}70` }}
                                      >
                                        {isMovie ? "Movie" : "TV"}
                                      </span>
                                      <span className="text-xs text-[var(--ink-muted)]">
                                        ·
                                      </span>
                                      <span className="truncate text-sm font-semibold text-white/75 transition-colors group-hover/attr:text-white sm:text-base">
                                        {rep.tmdbTitle || `#${rep.tmdbId}`}
                                      </span>
                                      {rep.tmdbYear && (
                                        <span className="flex-shrink-0 text-xs text-[var(--ink-muted)]">
                                          {rep.tmdbYear}
                                        </span>
                                      )}
                                    </Link>

                                    <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">
                                      {review.status === "FLAGGED" && (
                                        <span className="rounded border border-yellow-500/15 bg-yellow-500/10 px-1.5 py-0.5 text-xs font-bold uppercase tracking-widest text-yellow-300">
                                          flagged
                                        </span>
                                      )}
                                      {group.reviews.length > 1 &&
                                        rIdx === 0 &&
                                        !hasLess && (
                                          <span className="text-xs font-medium text-[var(--ink-muted)]">
                                            +{group.reviews.length - 1}
                                          </span>
                                        )}
                                      <span className="text-xs font-medium tabular-nums text-[var(--ink-muted)] sm:text-sm">
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
                                    className="flex items-center gap-1.5 text-xs font-medium text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
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
                                      className="flex items-center gap-1.5 text-xs font-medium text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
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
                                  className="ml-auto flex items-center gap-1.5 text-xs font-medium text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
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
                      <span className="ml-auto text-xs font-medium text-[var(--ink-muted)]">
                        {Math.min(reviewsVisible, filteredMediaGroups.length)}{" "}
                        of {filteredMediaGroups.length} titles
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile Filter Modal */}
        <AnimatePresence>
          {mobileFilterOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-3 sm:items-center sm:p-4"
              onClick={() => setMobileFilterOpen(false)}
            >
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                className="max-h-[86svh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-[var(--surface-border)] bg-[var(--surface-1)] p-5 mobile-native-scroll sm:rounded-2xl sm:p-6"
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
                    <CustomSelect
                      label="Filter by Type"
                      showLabel
                      value={filterType}
                      onChange={setFilterType}
                      options={[{ value: "all", label: "All Types" }, { value: "movie", label: "Movies" }, { value: "tv", label: "TV Series" }]}
                      widthClass="w-full"
                    />
                  </div>

                  <div>
                    <CustomSelect
                      label="Sort by"
                      showLabel
                      value={sortBy}
                      onChange={setSortBy}
                      options={[{ value: "dateAdded", label: "Date Added" }, { value: "rating", label: "Rating" }, { value: "title", label: "Title" }]}
                      widthClass="w-full"
                    />
                  </div>
                </div>

                <button
                  className="ui-primary-action mt-6 w-full justify-center"
                  onClick={() => setMobileFilterOpen(false)}
                >
                  Apply Filters
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {editOpen && (
            <dialog
              ref={editDialogRef}
              aria-labelledby="profile-edit-heading"
              className="fixed inset-0 m-0 flex h-dvh max-h-none w-full max-w-none items-end justify-center overflow-hidden bg-black/85 p-3 text-[var(--ink)] [&:not([open])]:hidden sm:items-center sm:p-6"
              onCancel={(event) => {
                event.preventDefault();
                if (!profileSaving) {
                  setAvatarPreview(null);
                  setEditOpen(false);
                }
              }}
              onClick={() => {
                if (!profileSaving) {
                  setAvatarPreview(null);
                  setEditOpen(false);
                }
              }}
            >
              <div
                className="ui-overlay-enter relative max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl overflow-y-auto overscroll-contain rounded-t-2xl border border-[var(--surface-border)] bg-[var(--surface-1)] p-6 shadow-2xl shadow-black/60 sm:max-h-[calc(100dvh-3rem)] sm:rounded-2xl sm:p-8"
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
                      <p className="ui-kicker">
                        Profile tune-up
                      </p>
                      <h2 id="profile-edit-heading" className="text-xl font-bold sm:text-2xl">
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
                    className="ui-secondary-action size-11 p-0 disabled:opacity-40"
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
                        className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-md bg-[var(--surface-2)] ring-2 ring-[var(--brand-coral)]/50 transition hover:ring-[var(--brand-coral-strong)]"
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
                      <label htmlFor="profile-display-name" className="flex items-center gap-2 text-sm font-semibold text-white/80">
                        <UserRound className="h-4 w-4 text-[var(--brand-coral-strong)]" />
                        Display name
                      </label>
                      <span
                        className={`text-xs tabular-nums ${profileName.length > 48 ? "text-red-400" : "text-white/35"}`}
                      >
                        {profileName.length}/50
                      </span>
                    </div>
                    <input
                      id="profile-display-name"
                      type="text"
                      value={profileName}
                      onChange={(e) =>
                        setProfileName(e.target.value.slice(0, 50))
                      }
                      maxLength={50}
                      className="w-full border-b border-[var(--surface-border)] bg-transparent px-1 py-3 text-sm text-[var(--ink)] outline-none transition placeholder:text-[var(--ink-muted)] focus:border-[var(--brand-coral)] focus:ring-0 sm:text-base"
                      placeholder="Enter your name"
                    />
                    <p className="text-xs text-white/35 mt-1">
                      2-50 characters
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label htmlFor="profile-username" className="flex items-center gap-2 text-sm font-semibold text-white/80">
                        <Sparkles className="h-4 w-4 text-[var(--brand-coral-strong)]" />
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
                        id="profile-username"
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
                        className="w-full border-b border-[var(--surface-border)] bg-transparent py-3 pl-8 pr-1 text-sm text-[var(--ink)] outline-none transition placeholder:text-[var(--ink-muted)] focus:border-[var(--brand-coral)] focus:ring-0 sm:text-base"
                        placeholder="username"
                      />
                    </div>
                    <p className="text-xs text-white/35 mt-1">
                      3-20 characters, letters, numbers, underscores only
                    </p>
                  </div>

                  <div>
                    <label htmlFor="profile-email" className="mb-2 flex items-center gap-2 text-sm font-semibold text-white/80">
                      <Mail className="h-4 w-4 text-[var(--brand-coral-strong)]" />
                      Email
                    </label>
                    <input
                      id="profile-email"
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
                        <Shield className="h-4 w-4 text-[var(--brand-coral-strong)]" />
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
                            className="h-4 w-4 accent-[var(--brand-coral)]"
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  {profileError && (
                    <p role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
                      {profileError}
                    </p>
                  )}
                </div>

                <div className="mt-7 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    className="ui-secondary-action order-2 w-full disabled:opacity-50 sm:order-1 sm:w-auto"
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
                    className="ui-primary-action order-1 w-full justify-center disabled:cursor-not-allowed disabled:opacity-50 sm:order-2 sm:w-auto"
                    onClick={saveProfile}
                    disabled={profileSaving}
                  >
                    <Save className="h-4 w-4" />
                    {profileSaving ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </div>
            </dialog>
        )}
      </div>
      {/* Avatar Lightbox — full-screen */}
      <AnimatePresence>
        {avatarLightbox && user?.avatarUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
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
function InsightTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-2)]/60 px-3.5 py-3">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-[var(--ink)]">{value}</p>
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
    <div className="group rounded-xl border border-[var(--surface-border)] bg-[var(--surface-1)] p-3.5 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[var(--brand-coral)]/40 sm:p-5">
      <div className="flex items-center justify-between">
        {icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand-coral)]/10 text-[var(--brand-coral-strong)] transition-colors group-hover:bg-[var(--brand-coral)] group-hover:text-white sm:h-10 sm:w-10">
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
        <p className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)] sm:mb-1">
          {label}
        </p>
        <p className="text-2xl font-bold text-[var(--ink)] sm:text-3xl">{value}</p>
      </div>
    </div>
  );
}
