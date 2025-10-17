// app/movies/[id]/credits/page.tsx
import AllCredits from "@/components/selected-content/extended/allCredits";
import type { Metadata } from "next";

type Props = {
  params: { id: string } | Promise<{ id: string }>;
  searchParams: { highlight?: string } | Promise<{ highlight?: string }>;
};

export async function generateMetadata({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Credits for ${id}` };
}

export default async function CreditsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { highlight } = (await searchParams) || {};

  const base = process.env.NEST_API_URL ?? "http://localhost:4000";

  try {
    const res = await fetch(`${base}/movies/details/${id}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      return (
        <main className="min-h-screen flex items-center justify-center p-8 bg-black text-white">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Credits not available</h2>
            <p className="mt-2 text-gray-400">
              Could not fetch credits for this item.
            </p>
          </div>
        </main>
      );
    }

    const data = await res.json();
    const credits = data.credits ?? { cast: [], crew: [] };
    const info = data.info;

    return (
      <main className="min-h-screen bg-black text-slate-100">
        <AllCredits
          credits={credits}
          info={info}
          id={id}
          highlight={highlight}
        />
      </main>
    );
  } catch (err) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 bg-black text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Credits not available</h2>
          <p className="mt-2 text-gray-400">Network error.</p>
        </div>
      </main>
    );
  }
}
