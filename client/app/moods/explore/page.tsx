import MoodDiscoverySection from "@/components/sections/MoodDiscoverySection";

export const metadata = {
  title: "Explore moods",
  description:
    "Find movies and TV shows for how you feel. Explore the mood wheel, mood matchers, or the Moodies Personality Quiz.",
};

export default function MoodsExplorePage() {
  return (
    <main className="min-h-screen bg-[var(--surface-0)] text-[var(--ink)] lg:pt-24">
      <MoodDiscoverySection />
    </main>
  );
}
