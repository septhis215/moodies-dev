// app/movies/[id]/reviews/page.tsx
import AllReviews from "@/components/selected-content/extended/allReviews";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ highlight?: string }>;
};

async function fetchReviews(id: string) {
  try {
    const base = process.env.NEST_API_URL ?? "http://localhost:4000";
    const res = await fetch(
      `${base}/reviews/media/MOVIE/${id}?page=1&limit=100`,
      {
        next: { revalidate: 60 },
        cache: "no-store",
      },
    );
    if (!res.ok)
      return {
        reviews: [],
        topMoods: [],
        pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
      };
    return res.json();
  } catch (err) {
    return {
      reviews: [],
      topMoods: [],
      pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
    };
  }
}

async function fetchReviewStats(id: string, mediaType: string) {
  try {
    const base = process.env.NEST_API_URL ?? "http://localhost:4000";
    const res = await fetch(`${base}/reviews/media/${mediaType}/${id}/stats`, {
      next: { revalidate: 60 },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch (err) {
    return null;
  }
}

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
  const reviewsData = await fetchReviews(id);
  const movieInfo = data.info;
  const mediaType = movieInfo.content_type === "tv" ? "TV" : "MOVIE";
  const reviewStats = await fetchReviewStats(id, mediaType);

  const transformedReviews = reviewsData.reviews.map((r: any) => ({
    id: r.id,
    author: r.user?.username || "Anonymous",
    author_details: {
      username: r.user?.username,
      name: r.user?.username,
      avatar_path: r.user?.avatarUrl,
      rating: r.rating,
    },
    content: r.content,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
    url: "",
    moodEmojis: r.moodEmojis || [],
    replies:
      r.replies?.map((reply: any) => ({
        content: reply.content,
        created_at: reply.createdAt,
        user: {
          username: reply.user?.username || "Anonymous",
          avatar_path: reply.user?.avatarUrl,
        },
      })) || [],
  }));

  return (
    <main className="min-h-screen bg-black text-slate-100">
      <AllReviews
        reviews={transformedReviews}
        info={movieInfo}
        id={id}
        topMoods={reviewsData.topMoods || []}
        reviewStats={reviewStats}
      />
    </main>
  );
}
