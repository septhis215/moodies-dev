// src/app/movies/page.tsx
import React from 'react';
import type { All } from '@/types/all';
import type { ReviewItem } from '@/components/sections/CommunityPicks';
import { Play, Star, Film, Award, TrendingUp, Calendar, Ticket, Plus, Info, ChevronRight } from '@/components/ui/icons';
import CommunityPicks from '@/components/sections/CommunityPicks';
import Image from 'next/image';

async function fetchTrendingMovies() {
  const base = process.env.NEST_API_URL || 'http://localhost:4000';
  const res = await fetch(`${base}/movies/featured`, { next: { revalidate: 60 } });
  if (!res.ok) return [];
  const json = await res.json();
  return json as All[];
}

async function fetchPopularMovies() {
  const base = process.env.NEST_API_URL || 'http://localhost:4000';
  const res = await fetch(`${base}/movies/trending`, { next: { revalidate: 60 } });
  if (!res.ok) return [];
  const json = await res.json();
  return json as All[];
}

async function fetchTopRatedMovies() {
  const base = process.env.NEST_API_URL || 'http://localhost:4000';
  const res = await fetch(`${base}/movies/favorites`, { next: { revalidate: 60 } });
  if (!res.ok) return [];
  const json = await res.json();
  return json as All[];
}

async function fetchMovieTrailers() {
  const base = process.env.NEST_API_URL || 'http://localhost:4000';
  const res = await fetch(`${base}/movies/trailers`, { next: { revalidate: 60 } });
  if (!res.ok) return [];
  const json = await res.json();
  return json as All[];
}

async function fetchNewMovieTrailers() {
  const base = process.env.NEST_API_URL || 'http://localhost:4000';
  const res = await fetch(`${base}/movies/upcoming-trailers`, { next: { revalidate: 60 } });
  if (!res.ok) return [];
  const json = await res.json();
  return json as All[];
}

async function fetchMovieReview() {
  const base = process.env.NEST_API_URL;
  const res = await fetch(`${base}/movies/trending-reviews`, { next: { revalidate: 60 } });
  if (!res.ok) return [];
  const json = await res.json();
  return json as ReviewItem[];
}

export const metadata = {
  title: 'Movies - Moodies',
  description: 'Discover trending movies and upcoming releases',
};

export default async function MovieHomePage() {
  const [trendingMovies, popularMovies, topRatedMovies, movieTrailers, newMovieTrailers, movieReviews] = await Promise.all([
    fetchTrendingMovies(),
    fetchPopularMovies(),
    fetchTopRatedMovies(),
    fetchMovieTrailers(),
    fetchNewMovieTrailers(),
    fetchMovieReview(),
  ]);

  const heroMovie = trendingMovies[0];
  const getImageUrl = (path: string | undefined) => path ? `https://image.tmdb.org/t/p/original${path}` : '/placeholder.jpg';
  const getPosterUrl = (path: string | undefined) => path ? `https://image.tmdb.org/t/p/w500${path}` : '/placeholder.jpg';

  return (
    <main className="bg-black min-h-screen text-white overflow-x-hidden">
      {/* Epic Cinematic Hero */}
      {heroMovie && (
        <section className="relative h-screen min-h-[600px] max-h-[1080px]">
          {/* Background with Film Grain */}
          <div className="absolute inset-0">
            {heroMovie.backdrop_path && (
              <Image
                src={getImageUrl(heroMovie.backdrop_path)}
                alt={heroMovie.title || heroMovie.name || ""}
                fill
                priority
                className="object-cover"
                style={{ filter: "brightness(0.35)" }}
              />
            )}
          </div>

          {/* Hero Content */}
          <div className="relative h-full max-w-[1920px] mx-auto px-4 sm:px-6 md:px-10 lg:px-16 xl:px-20">
            <div className="h-full flex flex-col md:flex-row items-center gap-8 lg:gap-16 pt-20 md:pt-0">
              {/* Movie Poster */}
              <div className="w-56 sm:w-64 md:w-72 lg:w-80 xl:w-96 flex-shrink-0 transform hover:scale-105 transition-transform duration-500">
                <div className="relative group">
                  <div className="absolute -inset-3 sm:-inset-4 lg:-inset-6 bg-gradient-to-br from-amber-500/30 via-red-600/30 to-orange-600/30 rounded-2xl sm:rounded-3xl blur-2xl group-hover:blur-3xl transition-all" />
                  {heroMovie.poster_path && (
                    <Image
                      src={getPosterUrl(heroMovie.poster_path)}
                      alt={heroMovie.title || heroMovie.name || ''}
                      width={384}
                      height={576}
                      priority
                      className="relative rounded-xl sm:rounded-2xl shadow-2xl w-full"
                    />
                  )}
                </div>
              </div>

              {/* Movie Info */}
              <div className="flex-1 space-y-4 sm:space-y-6 lg:space-y-8 max-w-4xl pb-8 md:pb-0">
                {/* Awards & Status Badges */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:gap-4">
                  <div className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-amber-600 to-yellow-500 rounded-full shadow-lg">
                    <Award className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="font-bold text-xs sm:text-sm uppercase tracking-wide">Featured</span>
                  </div>
                  <span className="px-3 sm:px-4 py-2 bg-red-600/90 backdrop-blur-sm rounded-full font-bold text-xs sm:text-sm uppercase tracking-wide shadow-lg">
                    Now in Theaters
                  </span>
                </div>

                {/* Title */}
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tighter leading-none">
                  <span className="bg-gradient-to-r from-white via-amber-100 to-orange-100 bg-clip-text text-transparent">
                    {heroMovie.title || heroMovie.name}
                  </span>
                </h1>

                {/* Meta Information */}
                <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm sm:text-base lg:text-lg">
                  <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/20 backdrop-blur-sm rounded-lg border border-amber-500/30">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map(i => (
                        <Star key={i} className={`w-4 h-4 sm:w-5 sm:h-5 ${i <= Math.round((heroMovie.vote_average || 0) / 2) ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}`} />
                      ))}
                    </div>
                    <span className="text-amber-100 font-bold text-base sm:text-xl">{heroMovie.vote_average?.toFixed(1)}/10</span>
                  </div>
                  <span className="text-gray-300 font-semibold">{heroMovie.release_date?.split('-')[0]}</span>
                  <span className="px-3 py-1 border-2 border-gray-600 rounded-md font-bold text-gray-200">
                    {heroMovie.adult ? 'R' : 'PG-13'}
                  </span>
                </div>

                {/* Description */}
                <p className="text-base sm:text-lg lg:text-xl text-gray-300 leading-relaxed line-clamp-3 sm:line-clamp-4">
                  {heroMovie.overview}
                </p>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2 sm:pt-4">
                  <button className="group relative px-6 sm:px-10 py-3 sm:py-5 bg-gradient-to-r from-red-600 to-red-700 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base lg:text-lg overflow-hidden shadow-2xl shadow-red-600/50 hover:shadow-red-600/70 transition-all">
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-red-600 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                    <span className="relative flex items-center justify-center gap-2 sm:gap-3">
                      <Ticket className="w-5 h-5 sm:w-6 sm:h-6" />
                      Get Tickets
                    </span>
                  </button>
                  <button className="px-6 sm:px-10 py-3 sm:py-5 bg-white/10 backdrop-blur-xl border-2 border-white/30 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base lg:text-lg hover:bg-white/20 hover:border-white/50 transition-all flex items-center justify-center gap-2 sm:gap-3">
                    <Play className="w-5 h-5 sm:w-6 sm:h-6" />
                    Watch Trailer
                  </button>
                  <button className="px-6 sm:px-8 py-3 sm:py-5 bg-black/40 backdrop-blur-xl border-2 border-white/20 rounded-xl sm:rounded-2xl font-semibold text-sm sm:text-base hover:bg-black/60 transition-all flex items-center justify-center gap-2">
                    <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
                    <span className="hidden sm:inline">Watchlist</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Fade */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent" />
        </section>
      )}

      {/* Content Sections */}
      <div className="relative -mt-20 max-w-[1920px] mx-auto px-4 sm:px-6 md:px-10 lg:px-16 xl:px-20 space-y-12 sm:space-y-16 lg:space-y-24 pb-16 sm:pb-20 lg:pb-24">
        {/* Now Playing in Theaters */}
        {popularMovies.length > 0 && (
          <section>
            <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8 lg:mb-10">
              <div className="p-2 sm:p-3 bg-gradient-to-br from-red-600/20 to-amber-600/20 rounded-xl sm:rounded-2xl border border-red-500/30">
                <Film className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-red-500" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight">
                  <span className="bg-gradient-to-r from-red-500 to-amber-500 bg-clip-text text-transparent">
                    NOW PLAYING
                  </span>
                </h2>
                <p className="text-sm sm:text-base lg:text-lg text-gray-400">In theaters near you</p>
              </div>
              <button className="hidden sm:flex items-center gap-2 text-red-400 hover:text-red-300 font-semibold text-sm lg:text-base transition-colors group">
                View All
                <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5 transform group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 sm:gap-3 lg:gap-4">
              {popularMovies.slice(0, 16).map((movie, idx) => (
                <div key={movie.id} className="group cursor-pointer">
                  <div className="relative aspect-[2/3] rounded-md sm:rounded-lg lg:rounded-xl overflow-hidden bg-gray-900 shadow-xl">
                    {movie.poster_path && (
                      <Image
                        src={getPosterUrl(movie.poster_path)}
                        alt={movie.title || movie.name || ''}
                        fill
                        className="object-cover transform transition-all duration-500 group-hover:scale-110"
                      />
                    )}

                    {/* Ranking Badge */}
                    <div className="absolute top-0 left-0 w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-red-600 to-amber-600 flex items-center justify-center shadow-lg">
                      <span className="font-black text-sm sm:text-lg lg:text-2xl">{idx + 1}</span>
                    </div>

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-3 right-2 sm:right-3 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300 space-y-1.5 sm:space-y-2">
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 sm:w-4 sm:h-4 text-amber-400 fill-amber-400" />
                          <span className="text-xs sm:text-sm font-bold">{movie.vote_average?.toFixed(1)}</span>
                        </div>
                        <button className="w-full py-1.5 sm:py-2 bg-red-600 rounded-md sm:rounded-lg font-bold text-xs sm:text-sm hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5">
                          <Ticket className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span className="hidden sm:inline">Tickets</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  <h3 className="mt-1.5 sm:mt-2 text-xs sm:text-sm font-semibold line-clamp-2 group-hover:text-red-400 transition-colors leading-tight">
                    {movie.title || movie.name}
                  </h3>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Top Rated Movies - Premium Showcase */}
        {topRatedMovies.length > 0 && (
          <section className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-600/5 via-red-600/5 to-orange-600/5 rounded-3xl blur-3xl" />

            <div className="relative">
              <div className="flex items-center justify-between mb-6 sm:mb-8 lg:mb-10">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="p-2 sm:p-3 bg-gradient-to-br from-amber-600/20 to-yellow-600/20 rounded-xl sm:rounded-2xl border border-amber-500/30">
                    <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight">
                      <span className="bg-gradient-to-r from-amber-400 to-yellow-400 bg-clip-text text-transparent">
                        TOP RATED
                      </span>
                    </h2>
                    <p className="text-sm sm:text-base lg:text-lg text-gray-400">Highest rated films of all time</p>
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                {topRatedMovies.slice(0, 6).map((movie, idx) => (
                  <div key={movie.id} className="group relative rounded-xl sm:rounded-2xl lg:rounded-3xl overflow-hidden bg-gradient-to-br from-gray-900 to-black border border-gray-800 hover:border-amber-600/50 transition-all">
                    {/* Background Image */}
                    <div className="absolute inset-0 opacity-20">
                      {movie.backdrop_path && (
                        <Image
                          src={getImageUrl(movie.backdrop_path)}
                          alt=""
                          fill
                          className="object-cover transform group-hover:scale-110 transition-transform duration-700"
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div className="relative p-4 sm:p-6 lg:p-8">
                      <div className="flex gap-3 sm:gap-4 mb-4">
                        <div className="w-20 sm:w-24 lg:w-28 flex-shrink-0">
                          {movie.poster_path && (
                            <Image
                              src={getPosterUrl(movie.poster_path)}
                              alt={movie.title || movie.name || ''}
                              width={112}
                              height={168}
                              className="rounded-lg shadow-2xl"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-amber-400 mb-1 sm:mb-2">
                            #{idx + 1}
                          </div>
                          <h3 className="text-base sm:text-lg lg:text-xl font-bold mb-1 sm:mb-2 line-clamp-2">
                            {movie.title || movie.name}
                          </h3>
                          <div className="flex items-center gap-2 text-xs sm:text-sm">
                            <Star className="w-3 h-3 sm:w-4 sm:h-4 text-amber-400 fill-amber-400" />
                            <span className="font-bold text-white">{movie.vote_average?.toFixed(1)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-black/50 backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-4 border border-amber-600/30 mb-3 sm:mb-4">
                        <div className="text-gray-400 text-xs sm:text-sm mb-1">Release Year</div>
                        <div className="text-xl sm:text-2xl font-black text-amber-400 mb-2">
                          {movie.release_date?.split('-')[0]}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-400 line-clamp-2">
                          {movie.overview}
                        </div>
                      </div>

                      <button className="w-full py-2.5 sm:py-3 bg-gradient-to-r from-amber-600 to-red-600 rounded-lg sm:rounded-xl font-bold text-sm sm:text-base hover:from-amber-500 hover:to-red-500 transition-all flex items-center justify-center gap-2 shadow-lg">
                        <Play className="w-4 h-4 sm:w-5 sm:h-5" />
                        Watch Trailer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* New Releases */}
        {movieTrailers.length > 0 && (
          <section>
            <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8 lg:mb-10">
              <div className="p-2 sm:p-3 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-xl sm:rounded-2xl border border-purple-500/30">
                <Award className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-purple-400" />
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight">
                  <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    NEW RELEASES
                  </span>
                </h2>
                <p className="text-sm sm:text-base lg:text-lg text-gray-400">Recently released movies</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
              {movieTrailers.slice(0, 4).map((movie) => (
                <div key={movie.id} className="group flex flex-col sm:flex-row gap-4 sm:gap-6 p-4 sm:p-6 lg:p-8 rounded-xl sm:rounded-2xl lg:rounded-3xl bg-gradient-to-br from-purple-900/20 to-gray-900/50 border border-purple-500/30 hover:border-purple-500/60 transition-all cursor-pointer backdrop-blur-sm">
                  <div className="w-full sm:w-28 md:w-32 lg:w-36 flex-shrink-0">
                    {movie.poster_path && (
                      <Image
                        src={getPosterUrl(movie.poster_path)}
                        alt={movie.title || movie.name || ''}
                        width={144}
                        height={216}
                        className="rounded-lg shadow-xl transform group-hover:scale-105 transition-transform duration-300 w-full"
                      />
                    )}
                  </div>

                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div>
                      <div className="flex items-center gap-2 mb-2 sm:mb-3">
                        <div className="px-2 sm:px-3 py-1 bg-purple-600/80 rounded-full text-xs sm:text-sm font-bold uppercase">
                          NEW
                        </div>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map(i => (
                            <Star key={i} className={`w-3 h-3 sm:w-4 sm:h-4 ${i <= Math.round((movie.vote_average || 0) / 2) ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}`} />
                          ))}
                        </div>
                      </div>

                      <h3 className="text-lg sm:text-xl lg:text-2xl font-bold mb-2 group-hover:text-purple-400 transition-colors line-clamp-1">
                        {movie.title || movie.name}
                      </h3>

                      <p className="text-xs sm:text-sm text-gray-400 leading-relaxed mb-3 sm:mb-4 line-clamp-2 sm:line-clamp-3">
                        {movie.overview}
                      </p>

                      <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500">
                        <span>{movie.release_date?.split('-')[0]}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3" />
                          {movie.vote_average?.toFixed(1)}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2 sm:gap-3 mt-4">
                      <button className="flex-1 py-2 bg-purple-600 rounded-lg font-semibold text-xs sm:text-sm hover:bg-purple-700 transition-colors flex items-center justify-center gap-2">
                        <Play className="w-3 h-3 sm:w-4 sm:h-4" />
                        Trailer
                      </button>
                      <button className="flex-1 py-2 border border-purple-600 text-purple-400 rounded-lg font-semibold text-xs sm:text-sm hover:bg-purple-600 hover:text-white transition-all">
                        Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Community Reviews */}
        <CommunityPicks data={movieReviews} />

        {/* Coming Soon */}
        {newMovieTrailers.length > 0 && (
          <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl">
            <div className="absolute inset-0 bg-gradient-to-r from-red-900/30 via-black to-amber-900/30" />
            <div className="absolute inset-0">
              <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse" />
              <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            </div>

            <div className="relative px-4 sm:px-8 lg:px-12 py-8 sm:py-12 lg:py-16">
              <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8 lg:mb-10">
                <div className="p-2 sm:p-3 bg-gradient-to-br from-red-600/20 to-amber-600/20 rounded-xl sm:rounded-2xl border border-red-500/30">
                  <Calendar className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-red-500" />
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight">
                    <span className="bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 bg-clip-text text-transparent">
                      COMING SOON
                    </span>
                  </h2>
                  <p className="text-sm sm:text-base lg:text-lg text-gray-400">Most anticipated releases</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-6">
                {newMovieTrailers.slice(0, 10).map((movie) => (
                  <div key={movie.id} className="group cursor-pointer">
                    <div className="relative aspect-[2/3] rounded-lg sm:rounded-xl lg:rounded-2xl overflow-hidden mb-2 sm:mb-3 bg-gray-900 shadow-xl transform transition-all duration-300 group-hover:scale-105">
                      {movie.poster_path && (
                        <Image
                          src={getPosterUrl(movie.poster_path)}
                          alt={movie.title || movie.name || ''}
                          fill
                          className="object-cover transform group-hover:scale-110 transition-transform duration-500"
                        />
                      )}

                      {/* Release Date Badge */}
                      <div className="absolute top-2 sm:top-3 left-2 sm:left-3 right-2 sm:right-3">
                        <div className="bg-gradient-to-r from-red-600 to-amber-600 backdrop-blur-sm rounded-lg p-2 sm:p-3 text-center shadow-2xl border border-white/10">
                          <div className="text-red-100 text-xs font-bold uppercase tracking-wider mb-0.5">Releases</div>
                          <div className="text-white font-black text-xs sm:text-sm">
                            {movie.release_date ? new Date(movie.release_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBA'}
                          </div>
                        </div>
                      </div>

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-red-900/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 right-2 sm:right-4 space-y-1.5 sm:space-y-2">
                          <div className="flex items-center gap-1 text-xs">
                            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                            <span className="font-bold">{movie.vote_average?.toFixed(1)}</span>
                          </div>
                          <button className="w-full py-1.5 sm:py-2 bg-gradient-to-r from-red-600 to-amber-600 rounded-lg font-bold text-xs sm:text-sm hover:from-red-500 hover:to-amber-500 transition-all shadow-lg flex items-center justify-center gap-1.5">
                            <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                            Notify Me
                          </button>
                        </div>
                      </div>
                    </div>

                    <h3 className="font-bold text-xs sm:text-sm line-clamp-2 group-hover:text-red-400 transition-colors leading-tight">
                      {movie.title || movie.name}
                    </h3>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Bottom CTA Section */}
        <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-red-900/40 via-amber-900/40 to-orange-900/40 border border-red-500/30 p-8 sm:p-12 lg:p-16 text-center">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE2YzAtMi4yMS0xLjc5LTQtNC00cy00IDEuNzktNCA0IDEuNzkgNCA0IDQgNC0xLjc5IDQtNHptMCAyNGMwLTIuMjEtMS43OS00LTQtNHMtNCAxLjc5LTQgNCAxLjc5IDQgNCA0IDQtMS43OSA0LTR6bS0yNCAwYzAtMi4yMS0xLjc5LTQtNC00cy00IDEuNzktNCA0IDEuNzkgNCA0IDQgNC0xLjc5IDQtNHptMC0yNGMwLTIuMjEtMS43OS00LTQtNHMtNCAxLjc5LTQgNCAxLjc5IDQgNCA0IDQtMS43OSA0LTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />

          <div className="relative z-10 max-w-3xl mx-auto space-y-4 sm:space-y-6">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight">
              <span className="bg-gradient-to-r from-red-400 via-amber-400 to-orange-400 bg-clip-text text-transparent">
                Experience Cinema Like Never Before
              </span>
            </h2>
            <p className="text-sm sm:text-base lg:text-lg text-gray-300 max-w-2xl mx-auto">
              Discover thousands of movies from blockbusters to indie gems. Book your tickets now.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-4">
              <button className="px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-red-600 to-amber-600 text-white rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base hover:from-red-500 hover:to-amber-500 transition-all transform hover:scale-105 shadow-2xl shadow-red-600/50">
                Find Showtimes
              </button>
              <button className="px-6 sm:px-8 py-3 sm:py-4 bg-white/10 backdrop-blur-xl border-2 border-white/30 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base hover:bg-white/20 hover:border-white/50 transition-all">
                Browse All Movies
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Mobile View All Button */}
      <div className="sm:hidden px-4 pb-8">
        <button className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors">
          View All Movies
        </button>
      </div>
    </main >
  );
}