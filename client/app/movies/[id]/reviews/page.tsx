// app/movies/[id]/reviews/page.tsx
import AllReviews from "@/components/selected-content/extended/allReviews";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ highlight?: string }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Reviews for ${id}` };
}

export default async function ReviewsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;

  const base = process.env.NEST_API_URL ?? "http://localhost:4000";

  // Fetch movie details (which includes reviews)
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
  const movieInfo = data.info; // Get movie info from the response

  return (
    <main className="min-h-screen bg-black text-slate-100">
      <AllReviews
        reviews={reviews}
        info={movieInfo}
        id={id}
      />
    </main>
  );
}
