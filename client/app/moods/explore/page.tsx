import MoodDiscoverySection from "@/components/sections/MoodDiscoverySection";

export const metadata = {
  title: "Moods - Moodies",
  description: "Choose between the mood wheel, movie and TV mood matchers, and the Moodies quiz.",
};

export default function MoodsExplorePage() {
  return (
    <main className="min-h-screen bg-black pt-14 text-white sm:pt-16">
      <MoodDiscoverySection />
    </main>
  );
}
