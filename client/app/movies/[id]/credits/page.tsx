// app/movies/[id]/credits/page.tsx
import AllCredits from "@/components/selected-content/extended/allCredits";
import { CreditsPageUnavailable } from "@/components/selected-content/extended/creditsPageStates";
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
  return { title: `Credits for ${id}` };
}

export default async function CreditsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { highlight } = (await searchParams) || {};

  const base = process.env.NEST_API_URL ?? "https://dev.api.moodies.tech/api";

  try {
    const res = await fetch(`${base}/movies/details/${id}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      return <CreditsPageUnavailable backHref={`/movies/${id}`} />;
    }

    const data = await res.json();
    const credits = data.credits ?? { cast: [], crew: [] };
    const info = data.info;
    if (!info) return <CreditsPageUnavailable backHref={`/movies/${id}`} />;

    return (
      <AllCredits
        credits={credits}
        info={info}
        id={id}
        highlight={highlight}
      />
    );
  } catch {
    return <CreditsPageUnavailable backHref={`/movies/${id}`} />;
  }
}
