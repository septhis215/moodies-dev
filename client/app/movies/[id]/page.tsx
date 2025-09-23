import React from "react";
import SpecificMovieCard, {
  Movie as SpecificMovieType,
} from "@/components/selected-movie/movieTopContent";
import MovieDetails, {
  MovieDetailsData,
} from "@/components/selected-movie/movieDetails";
import ReviewsSection from "@/components/selected-movie/reviewsSection";
import MovieCarousel from "@/components/sections/MovieCarousel";
import type { Metadata } from "next";

type Params = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Movie ${id}` };
}

export default async function MoviePage({ params }: { params: Params }) {
  const { id } = await params;
  const base = process.env.NEST_API_URL ?? "http://localhost:4000";

  // Server-side fetch; cache for 60s
  const res = await fetch(`${base}/movies/details/${id}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold">Movie not found</h2>
          <p className="mt-2 text-gray-400">Unable to fetch movie details.</p>
        </div>
      </main>
    );
  }

  const data = await res.json();

  const info = data.info ?? {};
  const credits = data.credits ?? {};
  const director =
    (credits?.crew ?? []).find((c: any) => c.job === "Director")?.name ??
    undefined;

  const mappedMovie: SpecificMovieType = {
    id: info.id,
    title: info.title ?? info.name ?? "Untitled",
    year: (info.release_date ?? info.first_air_date ?? "").slice(0, 4) || "—",
    poster: info.poster_path
      ? `https://image.tmdb.org/t/p/w500${info.poster_path}`
      : "/placeholder.jpg",
    backdrop: info.backdrop_path
      ? `https://image.tmdb.org/t/p/original${info.backdrop_path}`
      : "/placeholder_backdrop.jpg",
    genres: (info.genres ?? []).map((g: any) => g.name ?? g),
    runtime: info.runtime
      ? `${Math.floor(info.runtime / 60)}h ${info.runtime % 60}m`
      : "—",
    rating: info.vote_average ?? 0,
    overview: info.overview ?? "",
    director,
    ageRating: info.adult ? "R" : "PG-13",
  };

  // Prepare data for the details component
  const movieDetailsData: MovieDetailsData = {
    info: {
      id: info.id,
      title: info.title ?? "Untitled",
      overview: info.overview ?? "",
      release_date: info.release_date ?? "",
      runtime: info.runtime ?? 0,
      budget: info.budget ?? 0,
      revenue: info.revenue ?? 0,
      vote_average: info.vote_average ?? 0,
      vote_count: info.vote_count ?? 0,
      genres: info.genres ?? [],
      production_companies: info.production_companies ?? [],
      production_countries: info.production_countries ?? [],
      spoken_languages: info.spoken_languages ?? [],
      status: info.status ?? "Released",
      tagline: info.tagline,
      homepage: info.homepage,
    },
    credits: {
      cast: (credits?.cast ?? []).sort(
        (a: any, b: any) => (a.order || 999) - (b.order || 999)
      ),
      crew: credits?.crew ?? [],
    },
    providers: data.providers ?? { results: {} },
    reviews: data.reviews ?? { results: {} },
    similar: data.similar ?? { results: {} },
  };

  return (
    <main>
      <SpecificMovieCard movie={mappedMovie} />
      <div className="min-h-screen bg-black text-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-16 space-y-14">
          <MovieDetails data={movieDetailsData} />

          <hr className="border-white/8 my-14" />
          <ReviewsSection reviews={data.reviews} movieId={id}/>

          {/* Similar Movies Section */}
          <hr className="border-white/8 my-14" />
          <MovieCarousel
            title="Similar Movies"
            subtitle="Films you may also enjoy"
            items={data.similar}
          />
        </div>
      </div>
    </main>
  );
}
