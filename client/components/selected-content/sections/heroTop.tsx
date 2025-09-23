"use client";

import React from "react";

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
    production_countries: Array<{ iso_3166_1: string; name: string }>;
    spoken_languages: Array<{ iso_639_1: string; name: string }>;
    status: string;
    tagline?: string;
    homepage?: string;
    poster_path?: string;
    backdrop_path?: string;
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
};

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
            i < fullStars ? "text-yellow-400" : "text-white/30"
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
      <span className="ml-2 text-xs text-white/70">{rating.toFixed(1)}</span>
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

// Helper function to find director from crew
function findDirector(crew: MovieDetailsData["credits"]["crew"]): string {
  const director = crew.find((person) => person.job === "Director");
  return director?.name || "Unknown";
}

// Component that accepts either Content or MovieDetailsData
interface HeroContentCardProps {
  content?: Content;
  data?: MovieDetailsData;
}

export function HeroContentCard({ content, data }: HeroContentCardProps) {
  // If data prop is provided, map it to the Content format
  const mappedContent: Content = React.useMemo(() => {
    if (content) return content;

    if (!data) {
      throw new Error("Either content or data prop must be provided");
    }

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
      director: findDirector(data.credits.crew),
      ageRating: undefined, // This would need to come from certification data if available
    };
  }, [content, data]);

  return (
    <div className="w-full min-h-screen relative text-white font-inter overflow-hidden">
      <div
        className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${mappedContent.backdrop})`,
          backgroundSize: "cover",
          backgroundPosition: "center center",
        }}
        aria-hidden
      />

      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

      {/* Content Container - Positioned very close to bottom */}
      <div className="relative min-h-screen flex items-end justify-center px-4 sm:px-6 lg:px-8 pb-8 sm:pb-12 lg:pb-16">
        <div className="w-full max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start lg:items-center">
            {/* Poster */}
            <div className="flex-shrink-0 w-48 sm:w-56 lg:w-64 xl:w-72 mx-auto lg:mx-0">
              <div className="rounded-lg shadow-2xl overflow-hidden transform transition-transform hover:scale-105">
                <img
                  src={mappedContent.poster}
                  alt={`${mappedContent.title} poster`}
                  className="w-full h-auto block"
                />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 text-center lg:text-left space-y-4 lg:space-y-6">
              {/* Title and Year */}
              <div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-extrabold tracking-tight leading-tight">
                  {mappedContent.title}
                </h1>
                <div className="mt-3 flex items-center justify-center lg:justify-start gap-3 flex-wrap">
                  <span className="text-sm bg-white/10 border border-white/20 px-3 py-1 rounded-md">
                    {mappedContent.year}
                  </span>
                  {mappedContent.ageRating && (
                    <span className="text-xs bg-green-600 text-black px-3 py-1 rounded-md font-medium">
                      {mappedContent.ageRating}
                    </span>
                  )}
                  <span className="text-sm text-white/70 flex items-center gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path strokeWidth={1.5} d="M12 3v18m9-9H3" />
                    </svg>
                    {mappedContent.runtime}
                  </span>
                </div>
              </div>

              {/* Director and Rating */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 sm:gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white/70">Directed by</span>
                  <span className="text-sm font-medium text-white">
                    {mappedContent.director ?? "Unknown"}
                  </span>
                </div>
                <StarRating rating={mappedContent.rating} />
              </div>

              {/* Genres */}
              <div className="flex items-center justify-center lg:justify-start gap-2 flex-wrap">
                {mappedContent.genres.map((g) => (
                  <GenreBadge key={g}>{g}</GenreBadge>
                ))}
              </div>

              {/* Overview */}
              <p className="max-w-3xl text-white/90 leading-relaxed text-sm sm:text-base lg:text-lg">
                {mappedContent.overview}
              </p>

              {/* Actions */}
              <div className="flex items-center justify-center lg:justify-start gap-3 flex-wrap pt-2">
                <button className="inline-flex items-center gap-2 bg-white text-black px-6 py-3 rounded-lg hover:bg-white/90 transition-colors font-medium">
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

                <button className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg transition-colors">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path strokeWidth={1.5} d="M12 5v7l3 3" />
                  </svg>
                  <span>Review</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HeroContentCard;
