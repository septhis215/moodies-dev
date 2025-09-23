// app/movies/[id]/reviews/page.tsx
import AllReviews from "@/components/selected-movie/allReviews";
import type { Metadata } from "next";

type Props = {
  params: { id: string };
  searchParams?: { highlight?: string };
};

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  return { title: `Reviews for movie ${params.id}` };
}

export default async function ReviewsPage({ params, searchParams }: Props) {
  const { id } = params;
  const base = process.env.NEST_API_URL ?? "http://localhost:4000";

  // fetch movie details (same endpoint you use elsewhere)
  const res = await fetch(`${base}/movies/details/${id}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 bg-black text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Reviews not available</h2>
          <p className="mt-2 text-gray-400">
            Could not fetch reviews for this movie.
          </p>
        </div>
      </main>
    );
  }

  const data = await res.json();
  const reviews = data.reviews ?? [];

  // render the all-reviews client component inside your usual page wrapper
  return (
    <main className="min-h-screen bg-black text-slate-100">
      <div className="max-w-7xl mx-auto px-6 py-16 space-y-10">
        <AllReviews
          reviews={reviews}
          movieId={id}
          highlight={searchParams?.highlight ?? null}
        />
      </div>
    </main>
  );
}
