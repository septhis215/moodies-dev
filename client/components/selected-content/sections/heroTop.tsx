"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";

// Original Content type for internal use
export type Content = {
  id: number;
  title: string;
  year: number | string;
  poster: string;
  backdrop: string;
  genres: string[];
  runtime: string;
  rating: number; // 0 - 10
  overview: string;
  director?: string;
  ageRating?: string;
};

// Movie API data structure (matching your MovieDetailsData)
export type MovieDetailsData = {
  info: {
    id: number;
    title: string;
    overview: string;
    release_date: string;
    runtime: number;
    budget: number;
    revenue: number;
    vote_average: number;
    vote_count: number;
    genres: Array<{ id: number; name: string }>;
    production_companies: Array<{
      id: number;
      name: string;
      logo_path?: string;
    }>;
    production_countries: Array<{ iso_3166_1: string; name?: string }>;
    spoken_languages: Array<{ iso_639_1: string; name: string }>;
    status: string;
    tagline?: string;
    homepage?: string;
    poster_path?: string;
    backdrop_path?: string;
    content_type: "movie";
    director?: string;
    content_rating?: string;
  };
  credits: {
    cast: Array<{
      id: number;
      name: string;
      character: string;
      profile_path?: string;
      order: number;
    }>;
    crew: Array<{
      id: number;
      name: string;
      job: string;
      department: string;
      profile_path?: string;
    }>;
  };
  trailer?: {
    iso_639_1: string;
    iso_3166_1: string;
    name: string;
    key: string;
    site: string;
    size: number;
    type: string;
    official: boolean;
    published_at: string;
    id: string;
  };
  providers?: any;
  reviews?: any[];
  similar?: any[];
  raw?: any;
};

// TV API data structure (matching your updated TvService)
export type TvDetailsData = {
  info: {
    id: number;
    title: string;
    original_title?: string;
    overview: string;
    release_date: string; // maps to first_air_date
    runtime: number; // normalized from episode_run_time
    budget: number;
    revenue: number;
    vote_average: number;
    vote_count: number;
    genres: Array<{ id: number; name: string }>;
    production_companies: Array<{
      id: number;
      name: string;
      logo_path?: string;
    }>;
    production_countries: Array<{ iso_3166_1: string; name?: string }>;
    spoken_languages: Array<{ iso_639_1: string; name: string }>;
    status: string;
    tagline?: string;
    homepage?: string;
    poster_path?: string;
    backdrop_path?: string;
    adult: boolean;
    created_by?: Array<{ id: number; name: string }>;
    content_type: "tv";
    director?: string; // creator name
    content_rating?: string;
    // TV-specific fields
    number_of_seasons?: number;
    number_of_episodes?: number;
    episode_run_time?: number[];
    first_air_date?: string;
    last_air_date?: string;
    networks?: Array<{ id: number; name: string; logo_path?: string }>;
    seasons?: Array<any>;
  };
  credits: {
    cast: Array<{
      id: number;
      name: string;
      character: string;
      profile_path?: string;
      order: number;
    }>;
    crew: Array<{
      id: number;
      name: string;
      job: string;
      department: string;
      profile_path?: string;
    }>;
  };
  trailer?: {
    iso_639_1: string;
    iso_3166_1: string;
    name: string;
    key: string;
    site: string;
    size: number;
    type: string;
    official: boolean;
    published_at: string;
    id: string;
  };
  providers?: any;
  reviews?: any[];
  similar?: any[];
  raw?: any;
};

function TrailerModal({
  isOpen,
  onClose,
  trailerKey,
  title,
}: {
  isOpen: boolean;
  onClose: () => void;
  trailerKey: string;
  title: string;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button - positioned outside/above the video container */}
        <button
          onClick={onClose}
          className="absolute -top-10 sm:-top-12 right-0 sm:right-0 rounded-full bg-[#e94f37]/70 hover:bg-[#e94f37]/100 p-2 drop-shadow-lg focus:outline-none focus:ring-2 focus:ring-[#e94f37]/40 cursor-pointer"
          aria-label="Close trailer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-6 h-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Video container */}
        <div className="relative bg-gray-900 rounded-lg overflow-hidden shadow-2xl">
          <div className="relative" style={{ paddingBottom: "56.25%" }}>
            <iframe
              className="absolute top-0 left-0 w-full h-full"
              src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1`}
              title={`${title} Trailer`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  const fullStars = Math.round(rating / 2); // convert 0-10 -> 0-5
  return (
    <div className="flex items-center gap-1 text-sm">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className={`w-4 h-4 ${
            i < fullStars ? "text-yellow-400" : "text-white/85"
          }`}
          fill={i < fullStars ? "currentColor" : "none"}
          stroke="currentColor"
        >
          <path
            strokeWidth="0"
            d="M12 .587l3.668 7.431L23.4 9.75l-5.7 5.56L19.336 24 12 20.202 4.663 24l1.636-8.69L.6 9.75l7.732-1.732L12 .587z"
          />
        </svg>
      ))}
      <span className="ml-2 text-xs text-white/85">{rating.toFixed(1)}</span>
    </div>
  );
}

function GenreBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] bg-white/10 border border-white/20 px-2 py-1 rounded-md mr-2">
      {children}
    </span>
  );
}

// Helper function to format runtime from minutes to hours and minutes
function formatRuntime(minutes: number): string {
  if (!minutes) return "Unknown";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

// Helper function to extract year from date string
function extractYear(dateString: string): string {
  if (!dateString) return "Unknown";
  return new Date(dateString).getFullYear().toString();
}

// Helper function to find director/creator from crew or created_by
function findDirectorOrCreator(
  crew: MovieDetailsData["credits"]["crew"] | TvDetailsData["credits"]["crew"],
  createdBy?: Array<{ id: number; name: string }>
): string {
  const director = crew.find((person) => person.job === "Director");
  if (director) return director.name;

  // For TV shows, fall back to creator
  if (createdBy && createdBy.length > 0) {
    return createdBy[0].name;
  }

  return "Unknown";
}

function ReadMore({ text, limit = 300 }: { text: string; limit?: number }) {
  const [expanded, setExpanded] = React.useState(false);

  if (!text) return null;

  const shouldTruncate = text.length > limit;
  const displayText =
    expanded || !shouldTruncate ? text : text.slice(0, limit).trim() + "…";

  return (
    <p className="max-w-3xl text-white/90 leading-relaxed text-xs sm:text-sm lg:text-sm xl:text-base">
      {displayText}
      {shouldTruncate && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-2 text-blue-400 hover:underline text-sm font-medium"
        >
          {expanded ? "Read less" : "Read more"}
        </button>
      )}
    </p>
  );
}

// Component that accepts either Content, MovieDetailsData, or TvDetailsData
interface HeroContentCardProps {
  content?: Content;
  data?: MovieDetailsData | TvDetailsData;
}

export function HeroContentCard({ content, data }: HeroContentCardProps) {
  const [isTrailerOpen, setIsTrailerOpen] = useState(false);

  const contentType = data?.info?.content_type === "tv" ? "tv" : "movies";
  const tvInfo = contentType ? (data as TvDetailsData).info : null;

  const trailerKey = data?.trailer?.key;

  const contentId = data?.info?.id ?? content?.id ?? null;
  const viewAllRef = contentId ? `/${contentType}/${contentId}/reviews` : "#";

  // If data prop is provided, map it to the Content format
  const mappedContent: Content = React.useMemo(() => {
    if (content) return content;

    if (!data) {
      throw new Error("Either content or data prop must be provided");
    }

    const isTV = data.info.content_type === "tv";
    const tvData = isTV ? (data as TvDetailsData) : null;

    console.log("API Results: ", data);

    return {
      id: data.info.id,
      title: data.info.title,
      year: extractYear(data.info.release_date),
      poster: data.info.poster_path
        ? `https://image.tmdb.org/t/p/w500${data.info.poster_path}`
        : "/placeholder-poster.jpg",
      backdrop: data.info.backdrop_path
        ? `https://image.tmdb.org/t/p/original${data.info.backdrop_path}`
        : "/placeholder-backdrop.jpg",
      genres: data.info.genres.map((g) => g.name),
      runtime: formatRuntime(data.info.runtime),
      rating: data.info.vote_average,
      overview: data.info.overview,
      director:
        data.info.director ||
        findDirectorOrCreator(data.credits.crew, tvData?.info.created_by),
      ageRating: data.info.content_rating,
    };
  }, [content, data]);

  return (
    <>
      <div className="w-full relative text-white font-inter overflow-hidden">
        {/* Background image - full screen */}
        <div className="fixed inset-0 -z-10">
          <Image
            src={mappedContent.backdrop}
            alt=""
            fill
            priority
            aria-hidden
            className="object-cover object-center"
            style={{
              filter: "brightness(1.1) grayscale(100%)",
              objectPosition: "center 50%",
            }}
          />

          {/* Grey to black gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-r from-gray-900 via-gray-800/20 to-black" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-gray-900/60 to-transparent" />
        </div>

        {/* Content Container - Add top padding for navbar and adjust height */}
        <div className="relative min-h-screen pt-20 sm:pt-24 md:pt-16 lg:pt-20 xl:pt-24 flex items-end justify-center px-4 sm:px-6 lg:px-8 pb-8 sm:pb-12 lg:pb-16">
          <div className="w-full max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start lg:items-center">
              {/* Poster */}
              <div className="flex-shrink-0 w-34 sm:w-42 lg:w-50 xl:w-58 mx-auto lg:mx-0">
                <div className="rounded-lg shadow-2xl overflow-hidden transform transition-transform hover:scale-105">
                  <Image
                    src={mappedContent.poster}
                    width={300}
                    height={450}
                    alt={`${mappedContent.title} poster`}
                    className="w-full h-auto block"
                  />
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 text-center lg:text-left space-y-3 lg:space-y-4">
                {/* Title and Year */}
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-extrabold tracking-tight leading-tight">
                    {mappedContent.title}
                  </h1>
                  <div className="mt-3 flex items-center justify-center lg:justify-start gap-3 flex-wrap">
                    <span className="text-xs sm:text-xs lg:text-xs xl:text-sm bg-white/10 border border-white/20 px-3 py-1 rounded-md">
                      {mappedContent.year}
                    </span>
                    {mappedContent.ageRating && (
                      <span className="text-xs sm:text-xs lg:text-xs xl:text-sm bg-green-600 text-black px-3 py-1 rounded-md font-medium">
                        {mappedContent.ageRating}
                      </span>
                    )}
                    <span className="text-xs sm:text-xs lg:text-xs xl:text-sm text-white/85 flex items-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-3 h-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path strokeWidth={2.5} d="M12 3v18m9-9H3" />
                      </svg>
                      {mappedContent.runtime}
                    </span>
                    {/* TV-specific info: seasons and episodes */}
                    {contentType && tvInfo && (
                      <>
                        {tvInfo.number_of_seasons && (
                          <span className="text-sm text-white/70 flex items-center gap-2">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="w-4 h-4"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                            >
                              <rect
                                width="18"
                                height="18"
                                x="3"
                                y="3"
                                rx="2"
                                ry="2"
                              />
                              <line x1="9" x2="9" y1="9" y2="15" />
                              <line x1="15" x2="15" y1="9" y2="15" />
                            </svg>
                            {tvInfo.number_of_seasons} Season
                            {tvInfo.number_of_seasons !== 1 ? "s" : ""}
                          </span>
                        )}
                        {tvInfo.number_of_episodes && (
                          <span className="text-sm text-white/70">
                            {tvInfo.number_of_episodes} Episodes
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Director/Creator and Rating */}
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 sm:gap-6">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-xs lg:text-xs xl:text-sm text-white/70">
                      {contentType ? "Created by" : "Directed by"}
                    </span>
                    <span className="text-xs sm:text-xs lg:text-xs xl:text-sm font-medium text-white">
                      {mappedContent.director ?? "Unknown"}
                    </span>
                  </div>
                  <StarRating rating={mappedContent.rating} />
                </div>

                {/* Network info for TV shows */}
                {contentType &&
                  tvInfo?.networks &&
                  tvInfo.networks.length > 0 && (
                    <div className="flex items-center justify-center lg:justify-start gap-2">
                      <span className="text-xs sm:text-xs lg:text-xs xl:text-sm text-white/70">
                        Network:
                      </span>
                      <span className="text-xs sm:text-xs lg:text-xs xl:text-sm font-medium text-white">
                        {tvInfo.networks.map((n) => n.name).join(", ")}
                      </span>
                    </div>
                  )}

                {/* Genres */}
                <div className="flex items-center justify-center lg:justify-start gap-2 flex-wrap">
                  {mappedContent.genres.map((g) => (
                    <GenreBadge key={g}>{g}</GenreBadge>
                  ))}
                </div>

                {/* Overview */}
                <ReadMore text={mappedContent.overview} limit={200} />

                {/* Actions */}
                <div className="flex items-center justify-center lg:justify-start gap-3 flex-wrap pt-2">
                  <button
                    onClick={() => trailerKey && setIsTrailerOpen(true)}
                    disabled={!trailerKey}
                    className="inline-flex items-center gap-2 bg-white text-black px-6 py-3 rounded-lg hover:bg-white/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M5 3v18l15-9L5 3z" />
                    </svg>
                    <span>Trailer</span>
                  </button>

                  <button className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-6 py-3 rounded-lg hover:bg-white/20 transition-colors">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        strokeWidth={1.5}
                        d="M12 21l-8-4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12l-8 4z"
                      />
                    </svg>
                    <span>Watchlist</span>
                  </button>

                  <button className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-6 py-3 rounded-lg hover:bg-white/20 transition-colors">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                    <span>Like</span>
                  </button>

                  <Link href={viewAllRef} className="inline-block">
                    <button className="inline-flex items-center gap-2 bg-gradient-to-r from-[#e94f37] to-[#ff6b58] px-6 py-3 rounded-lg transition-colors cursor-pointer">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M7.5 8.25h9m-9 3h6.75M21 12c0 4.418-4.03 8-9 8-1.043 0-2.047-.158-2.975-.45L4.5 20.25l1.196-2.392C4.65 16.76 4 14.463 4 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                      </svg>
                      <span>Review</span>
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trailer Modal */}
      {trailerKey && (
        <TrailerModal
          isOpen={isTrailerOpen}
          onClose={() => setIsTrailerOpen(false)}
          trailerKey={trailerKey}
          title={mappedContent.title}
        />
      )}
    </>
  );
}

export default HeroContentCard;
