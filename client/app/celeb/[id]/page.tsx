"use client";
import { useRouter } from "next/navigation";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useState, useEffect, use } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  MapPin,
  Award,
  Film,
  Tv,
  Instagram,
  Twitter,
  Facebook,
  Star,
  ChevronDown,
  ChevronUp,
  Camera,
  Users,
  Trophy,
  X,
  ExternalLink,
  Play,
  Heart,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Clock,
  Zap,
  TrendingUp,
  Users2,
  Clapperboard,
  Layers,
  PieChart,
  Info,
  Share2,
  BookmarkCheck,
  Plus,
  Car,
} from "lucide-react";
import Link from "next/link";
import { All } from "@/types/all";

interface Person {
  id: number;
  name: string;
  biography: string;
  birthday: string;
  deathday?: string;
  place_of_birth: string;
  profile_path: string;
  known_for_department: string;
  popularity: number;
  gender: number;
  also_known_as?: string[];
  homepage?: string;
  external_ids: {
    instagram_id: string;
    twitter_id: string;
    facebook_id: string;
    imdb_id: string;
  };
  images: {
    profiles: Array<{
      file_path: string;
      vote_average: number;
      aspect_ratio: number;
    }>;
  };
  combined_credits: {
    cast: Array<{
      id: number;
      title?: string;
      name?: string;
      character: string;
      poster_path: string;
      vote_average: number;
      release_date?: string;
      first_air_date?: string;
      media_type: string;
      genre_ids?: number[];
    }>;
  };
  tagged_images: {
    results: Array<{
      file_path: string;
      vote_average: number;
      media?: {
        id: number;
        title?: string;
        name?: string;
        media_type: "movie" | "tv";
        vote_average: number;
      };
    }>;
  };
}

interface SimilarPerson {
  id: number;
  name: string;
  profile_path: string;
  known_for_department: string;
  popularity: number;
}

interface UpcomingProject {
  id: number;
  title?: string;
  name?: string;
  poster_path: string;
  release_date?: string;
  first_air_date?: string;
  character?: string;
  media_type?: string;
}
interface Timeline {
  debut: { title: string; year: number; character: string; rating: number };
  breakout: { title: string; year: number; character: string; rating: number };
  recent: { title: string; year: number; character: string; rating: number };
  decades: Array<{
    period: string;
    count: number;
    avgRating: string;
    topWork: any;
  }>;
  totalYears: number;
}

interface Collaboration {
  id: number;
  name: string;
  count: number;
  projects: string[];
  profile_path: string;

}
export default function CelebrityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const [person, setPerson] = useState<Person | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [collaborations, setCollaborations] = useState<Collaboration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<"all" | "movies" | "tv">(
    "all"
  );
  const [bioExpanded, setBioExpanded] = useState(false);
  const [showAllCredits, setShowAllCredits] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [similarPeople, setSimilarPeople] = useState<SimilarPerson[]>([]);
  const [upcomingProjects, setUpcomingProjects] = useState<any[]>([]);
  const router = useRouter();
  const { add, remove, isInWatchlist, ready } = useWatchlist();
  const [watchlistStates, setWatchlistStates] = useState<
    Record<string | number, boolean>
  >({});
  const [loadingStates, setLoadingStates] = useState<
    Record<string | number, boolean>
  >({});
  const getImageUrl = (path?: string) =>
    path ? `https://image.tmdb.org/t/p/original${path}` : "/coming-soon.png";
  const getPosterUrl = (path?: string) =>
    path ? `https://image.tmdb.org/t/p/w500${path}` : "/coming-soon.png";

  useEffect(() => {
    const fetchPerson = async () => {
      try {
        const base =
          process.env.NEXT_PUBLIC_NEST_API_URL || "http://localhost:4000";

        const [personRes, similarRes, upcomingRes, timelineRes, collabRes] =
          await Promise.all([
            fetch(`${base}/people/${resolvedParams.id}`),
            fetch(`${base}/people/${resolvedParams.id}/similar`),
            fetch(`${base}/people/${resolvedParams.id}/upcoming`),
            fetch(`${base}/people/${resolvedParams.id}/timeline`),
            fetch(`${base}/people/${resolvedParams.id}/collaborations`),
          ]);

        const personData = await personRes.json();
        setPerson(personData);
        setSimilarPeople(await similarRes.json());

        const upData = await upcomingRes.json();
        setUpcomingProjects([...upData.movies, ...upData.tv]);

        const timelineData = await timelineRes.json();
        setTimeline(timelineData);

        const collabData = await collabRes.json();
        setCollaborations(collabData);
      } catch (error) {
        console.error("Error fetching celebrity:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPerson();
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#1a1a2e] to-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 border-4 border-[#e94f37] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white text-lg font-medium">
            Loading celebrity profile...
          </p>
        </div>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#1a1a2e] to-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-r from-[#e94f37] to-[#ff6b58] flex items-center justify-center mx-auto mb-4">
            <Users className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-white text-2xl font-bold mb-2">
            Celebrity not found
          </h2>
          <p className="text-gray-400">This profile doesn't exist</p>
        </div>
      </div>
    );
  }
  const getContentType = (item: any): "movie" | "tv" => {
    if (item.media_type) return item.media_type;
    if (item.type === "movies" || item.type === "movie") return "movie";
    if (item.type === "tv") return "tv";
    if (item.number_of_seasons || item.first_air_date || item.name) return "tv";
    return "movie";
  };

  const TVCard = ({
    show,
    size = "default",
  }: {
    show?: All;
    size?: "default" | "large" | "wide";
  }) => {
    if (!show) return null;
    const isWide = size === "wide";
    const isLarge = size === "large";

    // Make sure these are being read from parent scope
    const inWL = isInWatchlist(String(show.id), "series");
    const isLoading = loadingStates[show.id] || false;

    return (
      <div className="group relative h-full">
        <Link href={`/${getContentType(show) === 'tv' ? 'tv' : 'movies'}/${show.id}`} className="block h-full">
          <div
            className={`relative rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-950 shadow-xl ring-1 ring-white/5 ${isWide ? "aspect-video" : "aspect-[2/3]"
              }`}
          >
            <Image
              src={
                isWide
                  ? getImageUrl(show.backdrop_path)
                  : getPosterUrl(show.poster_path)
              }
              alt={show.title || show.name || ""}
              fill
              className="group-hover:scale-110 transition-transform duration-700 object-cover"
            />

            {/* Gradient overlay for depth */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <div className="absolute top-3 right-3 bg-black/90 backdrop-blur-md text-white px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg ring-1 ring-white/10">
              <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
              {show.vote_average && show.vote_average > 0
                ? show.vote_average.toFixed(1)
                : "New"}
            </div>

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="flex justify-center gap-2 mb-3">
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!ready) {
                        router.push("/auth/login");
                        return;
                      }
                      const itemId = show.id;
                      setLoadingStates((prev) => ({ ...prev, [itemId]: true }));
                      try {
                        const title = show?.title ?? show?.name ?? null;
                        const posterUrl = show?.poster_path
                          ? getPosterUrl(show.poster_path)
                          : null;
                        if (inWL) {
                          await remove(String(show.id), "series", {
                            title,
                            posterUrl,
                          });
                        } else {
                          await add(String(show.id), "series", {
                            title,
                            posterUrl,
                          });
                        }
                      } catch (err) {
                        console.error("toggle watchlist error", err);
                      } finally {
                        setLoadingStates((prev) => ({
                          ...prev,
                          [itemId]: false,
                        }));
                      }
                    }}
                    disabled={isLoading}
                    className={`w-10 h-10 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-xl
                                          ${inWL
                        ? "bg-emerald-500 ring-emerald-300/40 text-white"
                        : "bg-white text-black"
                      }
                                          ${isLoading
                        ? "opacity-70 cursor-not-allowed"
                        : ""
                      }`}
                    title={inWL ? "Remove from List" : "Add to List"}
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : inWL ? (
                      <BookmarkCheck className="w-5 h-5 text-white" />
                    ) : (
                      <Plus className="w-5 h-5 text-black" />
                    )}
                  </button>

                  <button
                    className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-xl"
                    title="More Info"
                  >
                    <Info className="w-5 h-5 text-black" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.preventDefault();
                    }}
                    className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-xl"
                    title="Share"
                  >
                    <Share2 className="w-5 h-5 text-black" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 px-1">
            <h4 className="font-bold text-sm sm:text-base line-clamp-2 group-hover:text-[#e94f37] transition-colors leading-tight text-white">
              {show.title || show.name}
            </h4>
            <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
              {show.first_air_date && (
                <span className="font-semibold">
                  {show.first_air_date.split("-")[0]}
                </span>
              )}
              {show.number_of_seasons && (
                <>
                  <span>•</span>
                  <span className="font-semibold">
                    {show.number_of_seasons} Season
                    {show.number_of_seasons > 1 ? "s" : ""}
                  </span>
                </>
              )}
            </div>
          </div>
        </Link>
      </div>
    );
  };




  const Carousel = ({ items }: { items: any[] }) => {
    const [startIndex, setStartIndex] = useState(0);
    const [itemsPerView, setItemsPerView] = useState(6);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
      const check = () => setIsMobile(window.innerWidth < 640);
      check();
      window.addEventListener("resize", check);
      return () => window.removeEventListener("resize", check);
    }, []);

    useEffect(() => {
      const updateLayout = () => {
        const w = window.innerWidth;
        if (w < 640) setItemsPerView(2);
        else if (w < 768) setItemsPerView(3);
        else if (w < 1024) setItemsPerView(4);
        else if (w < 1280) setItemsPerView(5);
        else setItemsPerView(6);
      };

      updateLayout();
      window.addEventListener("resize", updateLayout);
      return () => window.removeEventListener("resize", updateLayout);
    }, []);

    const canScrollLeft = startIndex > 0;
    const canScrollRight = startIndex < items.length - itemsPerView;

    const scrollLeft = () => {
      setStartIndex((prev) => Math.max(0, prev - itemsPerView));
    };

    const scrollRight = () => {
      setStartIndex((prev) =>
        Math.min(items.length - itemsPerView, prev + itemsPerView)
      );
    };

    const visibleItems = isMobile
      ? items
      : items.slice(startIndex, startIndex + itemsPerView);

    return (
      <div className="relative group/carousel">
        {!isMobile && canScrollLeft && (
          <button
            onClick={scrollLeft}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-12 h-12 bg-gradient-to-r from-[#e94f37] to-[#ff6b58] backdrop-blur-sm rounded-full flex items-center justify-center hover:scale-110 transition-all opacity-0 group-hover/carousel:opacity-100 shadow-2xl ring-2 ring-white/10"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {!isMobile && canScrollRight && (
          <button
            onClick={scrollRight}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-12 h-12 bg-gradient-to-r from-[#e94f37] to-[#ff6b58] backdrop-blur-sm rounded-full flex items-center justify-center hover:scale-110 transition-all opacity-0 group-hover/carousel:opacity-100 shadow-2xl ring-2 ring-white/10"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        <div
          className={
            isMobile
              ? "flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
              : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5"
          }
        >
          {visibleItems.map((person, idx) => (
            <motion.div
              key={person.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.03 }}
              className={isMobile ? "min-w-[140px] snap-start" : "group cursor-pointer"}
            >
              <Link href={`/celeb/${person.id}`}>
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-[#111] mb-3 group-hover:ring-2 group-hover:ring-[#e94f37] transition-all">
                  {person.profile_path ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w342${person.profile_path}`}
                      alt={person.name}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 bg-slate-700/30">
                      <Users2 size={28} />
                    </div>
                  )}
                </div>

                <h3 className="text-white font-semibold text-sm text-center line-clamp-2 mb-1">
                  {person.name}
                </h3>
                <p className="text-gray-500 text-xs text-center">
                  {person.known_for_department}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>

      </div>
    );
  };

  const movieCredits =
    person.combined_credits?.cast
      .filter((c) => c.media_type === "movie")
      .sort((a, b) => b.vote_average - a.vote_average) || [];
  const tvCredits =
    person.combined_credits?.cast
      .filter((c) => c.media_type === "tv")
      .sort((a, b) => b.vote_average - a.vote_average) || [];
  const allCredits = [...movieCredits, ...tvCredits].sort(
    (a, b) => b.vote_average - a.vote_average
  );

  const displayCredits =
    selectedTab === "all"
      ? allCredits
      : selectedTab === "movies"
        ? movieCredits
        : tvCredits;
  const getCreditDate = (credit: any) =>
    credit.release_date || credit.first_air_date || "";

  // Sort displayCredits by date descending (latest first)
  const sortedCredits = [...displayCredits].sort((a, b) => {
    const dateA = getCreditDate(a);
    const dateB = getCreditDate(b);
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });
  const visibleCredits = showAllCredits
    ? sortedCredits
    : sortedCredits.slice(0, 12);

  const age = person.birthday
    ? new Date().getFullYear() - new Date(person.birthday).getFullYear()
    : null;
  const shouldTruncateBio = person.biography && person.biography.length > 400;
  const displayBio =
    shouldTruncateBio && !bioExpanded
      ? person.biography.slice(0, 400) + "..."
      : person.biography;

  const backdropImage =
    visibleCredits.find((credit) => credit.poster_path)?.poster_path || null;

  // Genre mapping
  const genreMap: Record<number, string> = {
    28: "Action",
    12: "Adventure",
    16: "Animation",
    35: "Comedy",
    80: "Crime",
    99: "Documentary",
    18: "Drama",
    10751: "Family",
    14: "Fantasy",
    36: "History",
    27: "Horror",
    10402: "Music",
    9648: "Mystery",
    10749: "Romance",
    878: "Sci-Fi",
    10770: "TV Movie",
    53: "Thriller",
    10752: "War",
    37: "Western",
    10759: "Action & Adventure",
    10762: "Kids",
    10763: "News",
    10764: "Reality",
    10765: "Sci-Fi & Fantasy",
    10766: "Soap",
    10767: "Talk",
    10768: "War & Politics",
  };

  // Calculate genre stats
  const genreStats: Record<string, number> = {};
  allCredits.forEach((credit) => {
    credit.genre_ids?.forEach((genreId) => {
      const genreName = genreMap[genreId] || "Other";
      genreStats[genreName] = (genreStats[genreName] || 0) + 1;
    });
  });

  const topGenres = Object.entries(genreStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const totalGenreWorks = Object.values(genreStats).reduce((a, b) => a + b, 0);

  const SectionHeader = ({ icon: Icon, title }) => (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-xl bg-[#e94f37]/20 flex items-center justify-center">
        <Icon className="w-5 h-5 text-[#e94f37]" />
      </div>
      <h2 className="text-xl sm:text-2xl font-bold">{title}</h2>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-white">
      {/* Container */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <header className="relative grid lg:grid-cols-2 gap-2 mt-8 ">
          {/* LEFT: Profile card */}
          <div className="flex justify-center lg:justify-start">
            <div className="relative w-full max-w-[320px] rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-lg">
              {/* Decorative accent circle */}
              <div
                aria-hidden
                className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-10"
                style={{ background: "#e94f37" }}
              />

              {/* Image / poster */}
              <div className="relative w-full h-[430px] bg-zinc-900">
                {person?.profile_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w500${person.profile_path}`}
                    alt={person?.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-400">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" className="text-zinc-500">
                      <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"></circle>
                      <path d="M4 20c0-3.314 2.686-6 6-6h4c3.314 0 6 2.686 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                    </svg>
                  </div>
                )}

                {/* overlay badge row (top-left) */}
                <div className="absolute top-4 left-4 flex items-center gap-2">
                  {person?.known_for_department && (
                    <span
                      className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold"
                      style={{
                        background: "rgba(0,0,0,0.45)",
                        border: "1px solid rgba(255,255,255,0.04)",
                        color: "#ffd6cf",
                      }}
                    >
                      <Award className="w-3.5 h-3.5 text-[#e94f37]" />
                      {person.known_for_department}
                    </span>
                  )}
                </div>

                {/* bottom overlay with small meta + social icons */}
                <div className="absolute left-0 right-0 bottom-0 px-4 py-3 bg-gradient-to-t from-black/75 to-transparent flex items-center justify-between gap-4">
                  <div className="text-sm text-zinc-200">
                    <div className="font-semibold">{person?.name}</div>
                    <div className="text-xs text-zinc-400">
                      {person?.birthday ? new Date(person.birthday).getFullYear() : "—"}
                      {person.place_of_birth ? ` • ${person.place_of_birth}` : ""}
                    </div>
                  </div>


                </div>
              </div>


            </div>
          </div>

          {/* RIGHT: Info & stats */}
          <div className="space-y-6 mt-24">
            {/* Name + roles */}
            <div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tighter leading-tight">
                <span className="block text-white">{person?.name}</span>
                {/* <span className="block mt-1 text-[#e94f37] text-lg font-medium">
                  {person?.known_for_department ? `• ${person.known_for_department}` : ""}
                </span> */}
              </h1>
            </div>

            {/* Quick info pills */}
            <div className="flex flex-wrap gap-2">
              {person?.birthday && (
                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-zinc-900 border border-zinc-800 text-sm">
                  <Calendar className="w-4 h-4 text-[#e94f37]" />
                  <span className="text-zinc-200 text-sm">{new Date(person.birthday).toLocaleDateString()}</span>
                </div>
              )}

              {person?.place_of_birth && (
                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-zinc-900 border border-zinc-800 text-sm max-w-xs truncate">
                  <MapPin className="w-4 h-4 text-[#e94f37]" />
                  <span className="text-zinc-200 text-sm">{person.place_of_birth}</span>
                </div>
              )}

              {/* additional pills can go here */}
            </div>

            {/* Stats grid (responsive) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "Projects", value: allCredits?.length ?? 0, Icon: Film },
                { label: "Top Rated", value: allCredits?.filter(c => c.vote_average >= 7)?.length ?? 0, Icon: Star },
                { label: "Popularity", value: Math.round(person?.popularity ?? 0), Icon: TrendingUp },
              ].map((s, i) => (
                <div
                  key={i}
                  className="relative bg-zinc-900 border border-zinc-800 rounded-2xl p-3 sm:p-4 flex items-center gap-3 hover:shadow-[0_8px_30px_rgba(233,79,55,0.06)] transition"
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(180deg, rgba(233,79,55,0.12), rgba(0,0,0,0.0))" }}>
                    <s.Icon className="w-5 h-5 text-[#e94f37]" />
                  </div>

                  <div>
                    <div className="text-lg font-bold text-white">{s.value}</div>
                    <div className="text-xs text-zinc-400">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* small actions / share */}
            <div className="flex items-center gap-3 mt-1">
              {person?.external_ids?.instagram_id && (
                <a
                  href={`https://instagram.com/${person.external_ids.instagram_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-9 h-9 rounded-full bg-black/40 border border-white/5 flex items-center justify-center text-zinc-200 hover:bg-[#e94f37] hover:text-black transition"
                  aria-label="Open Instagram"
                >
                  <Instagram className="w-4 h-4" />
                </a>
              )}
              {person?.external_ids?.twitter_id && (
                <a
                  href={`https://twitter.com/${person.external_ids.twitter_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-9 h-9 rounded-full bg-black/40 border border-white/5 flex items-center justify-center text-zinc-200 hover:bg-[#e94f37] hover:text-black transition"
                  aria-label="Open Twitter"
                >
                  <Twitter className="w-4 h-4" />
                </a>
              )}
              {person?.external_ids?.imdb_id && (
                <a
                  href={`https://www.imdb.com/name/${person.external_ids.imdb_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-9 h-9 rounded-full bg-black/40 border border-white/5 flex items-center justify-center text-zinc-200 hover:bg-[#e94f37] hover:text-black transition"
                  aria-label="Open IMDb"
                >
                  <Star className="w-4 h-4" />
                </a>
              )}
              <a href={`https://www.google.com/search?q=${encodeURIComponent(person?.name || "")}`} target="_blank" rel="noreferrer" className="text-sm text-zinc-400 hover:text-white">
                More on web
              </a>
            </div>
          </div>
        </header>


        {/* Divider accent */}
        <div className="my-10 h-px bg-zinc-800" />

        {/* ABOUT */}
        {person?.biography && (
          <section className="space-y-4">
            <SectionHeader icon={Sparkles} title="Biography" />

            <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <p
                className={`text-zinc-300 leading-relaxed transition-all duration-300 ${bioExpanded ? "" : "line-clamp-5"
                  }`}
              >
                {person.biography}
              </p>

              {/* fade overlay when collapsed */}
              {!bioExpanded && (
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-zinc-900 to-transparent rounded-b-2xl" />
              )}

              {/* toggle */}
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setBioExpanded(!bioExpanded)}
                  className="text-sm font-semibold text-[#e94f37] hover:underline"
                >
                  {bioExpanded ? "Show less" : "Read more"}
                </button>
              </div>
            </div>
          </section>
        )}


        {/* Collaborators */}
        {collaborations?.length > 0 && (
          <section className="space-y-4 mt-8">
            <SectionHeader icon={Users} title="Frequent Collaborators" />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {collaborations.slice(0, 6).map((c) => (
                <a
                  key={c.id}
                  href={`/celeb/${c.id}`}
                  className="group relative bg-zinc-900 border border-zinc-800 rounded-2xl p-4 hover:border-[#e94f37] transition"
                >
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#e94f37]/10 to-transparent opacity-0 group-hover:opacity-100 transition" />

                  <div className="relative flex items-start gap-4">
                    {/* avatar */}
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center ">
                      {c.profile_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w342${c.profile_path}`}
                          alt={c.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500">
                          No image
                        </div>
                      )}
                    </div>


                    <div className="flex-1">
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-xs text-zinc-400">
                        {c.count} projects together
                      </div>

                      <div className="mt-2 text-xs text-zinc-500 line-clamp-2">
                        {c.projects?.slice(0, 3).join(" • ")}
                      </div>
                    </div>

                    <span className="text-[#e94f37] font-bold">{c.count}</span>
                  </div>
                </a>
              ))}
            </div>

          </section>
        )}

        {/* Career Stats */}
        <section className="mt-10 space-y-4">
          <SectionHeader icon={Trophy} title="Career Stats" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center hover:border-[#e94f37] transition">
              <div className="text-3xl font-bold">{movieCredits?.length ?? 0}</div>
              <div className="text-xs text-zinc-400 mt-1">Feature Films</div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center hover:border-[#e94f37] transition">
              <div className="text-3xl font-bold">{tvCredits?.length ?? 0}</div>
              <div className="text-xs text-zinc-400 mt-1">TV Productions</div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center hover:border-[#e94f37] transition">
              <div className="text-3xl font-bold">{allCredits?.filter?.((c) => c.vote_average >= 7)?.length ?? 0}</div>
              <div className="text-xs text-zinc-400 mt-1">Highly Rated</div>
            </div>

            {/* <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center hover:border-[#e94f37] transition">
              <div className="text-3xl font-bold">
                {person?.birthday ? (new Date().getFullYear() - new Date(person.birthday).getFullYear()) : "-"}
              </div>
              <div className="text-xs text-zinc-400 mt-1">Years Active (est.)</div>
            </div> */}
          </div>
        </section>

        {/* Genre Breakdown */}
        {Object.keys(genreStats || {}).length > 0 && (
          <section className="mt-10 space-y-4">
            <SectionHeader icon={PieChart} title="Genre Breakdown" />

            <div className="grid gap-4 md:grid-cols-2">
              {/* bars */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                {topGenres.map(([genre, count]) => {
                  const pct = Math.round((count / totalGenreWorks) * 100);
                  return (
                    <div key={genre}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{genre}</span>
                        <span className="text-zinc-400">{pct}%</span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#e94f37] to-orange-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* summary */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-4">
                  <Layers className="w-5 h-5 text-[#e94f37]" />
                  <span className="text-sm text-zinc-400">Most Frequent Genre</span>
                </div>
                <div className="text-2xl font-bold">{topGenres[0]?.[0]}</div>
                <div className="text-sm text-zinc-400 mt-1">
                  {topGenres[0]?.[1]} projects
                </div>
              </div>
            </div>

          </section>
        )}

        {/* Gallery (minimal, professional) */}
        {person?.images?.profiles?.length > 0 && (
          <section className="mt-10 space-y-4">
            <SectionHeader icon={Camera} title="Photo Gallery" />

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {person.images.profiles.slice(0, 12).map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage?.(`https://image.tmdb.org/t/p/original${img.file_path}`)}
                  className="rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 hover:border-[#e94f37] transition"
                >
                  <img
                    src={`https://image.tmdb.org/t/p/w342${img.file_path}`}
                    alt={`${person.name} photo ${i}`}
                    style={{ width: "100%", height: "220px", objectFit: "cover", display: "block" }}
                  />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Upcoming Projects */}
        {upcomingProjects?.length > 0 && (
          <section className="mt-10 space-y-4">
            <SectionHeader icon={Clock} title="Upcoming Projects" />

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {upcomingProjects.slice(0, 6).map((p) => (
                <a key={p.id} href={`/${p.media_type === "tv" ? "tv" : "movies"}/${p.id}`} className="block bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-[#e94f37] transition">
                  {p.poster_path ? (
                    <img src={`https://image.tmdb.org/t/p/w342${p.poster_path}`} alt={p.title || p.name} style={{ width: "100%", height: 260, objectFit: "cover" }} />
                  ) : (
                    <div className="w-full h-64 flex items-center justify-center text-zinc-500">No image</div>
                  )}
                  <div className="p-3">
                    <div className="text-sm font-semibold text-white line-clamp-2">{p.title || p.name}</div>
                    <div className="text-xs text-zinc-400 mt-1">{p.release_date || p.first_air_date ? new Date(p.release_date || p.first_air_date).toLocaleDateString() : "TBA"}</div>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Similar People */}
        {similarPeople?.length > 0 && (
          <section className="mt-10 space-y-4">
            <SectionHeader icon={Sparkles} title="You May Also Like" />


            <Carousel items={similarPeople} />

          </section>
        )}

        {/* FILMOGRAPHY */}
        <section className="mt-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
            <SectionHeader icon={Clapperboard} title="Filmography" />

            {/* Tabs */}
            <div className="flex w-full sm:w-auto overflow-x-auto sm:overflow-visible">
              <div className="flex gap-2 bg-zinc-900 border border-zinc-800 rounded-xl p-1 min-w-max">
                <button
                  className={`px-4 py-2 text-sm rounded-lg font-semibold whitespace-nowrap ${selectedTab === "all"
                    ? "bg-[#e94f37] text-black"
                    : "text-zinc-300"
                    }`}
                  onClick={() => {
                    setSelectedTab("all");
                    setShowAllCredits(false);
                  }}
                >
                  All ({allCredits?.length ?? 0})
                </button>

                <button
                  className={`px-4 py-2 text-sm rounded-lg font-semibold whitespace-nowrap ${selectedTab === "movies"
                    ? "bg-[#e94f37] text-black"
                    : "text-zinc-300"
                    }`}
                  onClick={() => {
                    setSelectedTab("movies");
                    setShowAllCredits(false);
                  }}
                >
                  Movies ({movieCredits?.length ?? 0})
                </button>

                <button
                  className={`px-4 py-2 text-sm rounded-lg font-semibold whitespace-nowrap ${selectedTab === "tv"
                    ? "bg-[#e94f37] text-black"
                    : "text-zinc-300"
                    }`}
                  onClick={() => {
                    setSelectedTab("tv");
                    setShowAllCredits(false);
                  }}
                >
                  TV ({tvCredits?.length ?? 0})
                </button>
              </div>
            </div>
          </div>


          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {visibleCredits.slice(0, displayCredits.length).map((show, idx) => (
              <TVCard key={show.id} show={show} />
            ))}
          </div>

          {/* view all / collapse */}
          {displayCredits.length > 12 && (
            <div className="mt-8 text-center">
              <button onClick={() => setShowAllCredits(!showAllCredits)} className="px-6 py-3 rounded-full bg-[#e94f37] text-black font-semibold">
                {showAllCredits ? "Show Less" : `View All (${displayCredits.length})`}
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Simple image modal - inline minimal */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setSelectedImage(null)}>
          <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedImage(null)} className="absolute -top-4 -right-4 bg-zinc-900 border border-zinc-800 rounded-full w-10 h-10 flex items-center justify-center">✕</button>
            <img src={selectedImage} alt="full" style={{ width: "100%", height: "auto", maxHeight: "80vh", objectFit: "contain" }} />
          </div>
        </div>
      )}
    </div>

  );
}
