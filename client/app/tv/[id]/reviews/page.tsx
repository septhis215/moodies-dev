// app/tv/[id]/reviews/page.tsx
import AllReviews from "@/components/selected-content/extended/allReviews";
import { ReviewsPageUnavailable } from "@/components/selected-content/extended/reviewsPageStates";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ highlight?: string }>;
};

type ApiReview = {
  id: string;
  rating: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  moodEmojis?: string[];
  reactionCounts?: Array<{ type: "LIKE" | "LOVE" | "HAHA" | "WOW" | "SAD" | "ANGRY"; count: number }>;
  myReaction?: "LIKE" | "LOVE" | "HAHA" | "WOW" | "SAD" | "ANGRY" | null;
  user?: {
    id?: string;
    username?: string;
    name?: string | null;
    avatarUrl?: string | null;
  };
  replies?: ApiReply[];
};

type ApiReply = {
  id?: string;
  content: string;
  createdAt: string;
  reactionCounts?: Array<{ type: "LIKE" | "LOVE" | "HAHA" | "WOW" | "SAD" | "ANGRY"; count: number }>;
  myReaction?: "LIKE" | "LOVE" | "HAHA" | "WOW" | "SAD" | "ANGRY" | null;
  user?: {
    id?: string;
    username?: string;
    avatarUrl?: string | null;
  };
};

async function fetchReviews(id: string) {
  try {
    const base = process.env.NEST_API_URL ?? "http://localhost:4000";
    const res = await fetch(`${base}/reviews/media/TV/${id}?page=1&limit=100`, {
      next: { revalidate: 60 },
      cache: "no-store",
    });
    if (!res.ok)
      return {
        reviews: [],
        topMoods: [],
        pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
      };
    return res.json();
  } catch {
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
  } catch {
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

export default async function ReviewsPage({ params }: Props) {
  const { id } = await params;

  const base = process.env.NEST_API_URL ?? "http://localhost:4000";

  const res = await fetch(`${base}/tv/details/${id}`, {
    next: { revalidate: 60 },
  }).catch(() => null);

  if (!res?.ok) {
    return (
      <ReviewsPageUnavailable
        message="Could not fetch reviews for this TV show."
        backHref={`/tv/${id}`}
      />
    );
  }

  const data = await res.json();
  const reviewsData = await fetchReviews(id);
  const tvInfo = data.info;
  const mediaType = tvInfo.content_type === "tv" ? "TV" : "MOVIE";
  const reviewStats = await fetchReviewStats(id, mediaType);

  const transformedReviews = reviewsData.reviews.map((r: ApiReview) => ({
    id: r.id,
    userId: r.user?.id,
    author: r.user?.name || r.user?.username || "Anonymous",
    author_details: {
      id: r.user?.id,
      username: r.user?.username,
      name: r.user?.name || r.user?.username,
      avatar_path: r.user?.avatarUrl,
      rating: r.rating,
    },
    content: r.content,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
    url: "",
    moodEmojis: r.moodEmojis || [],
    reactionCounts: r.reactionCounts || [],
    myReaction: r.myReaction || null,
    replies:
      r.replies?.map((reply) => ({
        id: reply.id,
        content: reply.content,
        created_at: reply.createdAt,
        reactionCounts: reply.reactionCounts || [],
        myReaction: reply.myReaction || null,
        user: {
          id: reply.user?.id,
          username: reply.user?.username || "Anonymous",
          avatar_path: reply.user?.avatarUrl,
        },
      })) || [],
  }));

  return (
    <main className="min-h-screen bg-black text-slate-100">
      <AllReviews
        reviews={transformedReviews}
        info={tvInfo}
        id={id}
        topMoods={reviewsData.topMoods || []}
        reviewStats={reviewStats}
      />
    </main>
  );
}
