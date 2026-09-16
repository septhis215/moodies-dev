import type { Metadata } from "next";
import DiscoverClient from "@/components/discover/DiscoverClient";

export const metadata: Metadata = {
  title: "Discover movies and series",
  description: "Search and filter Moodies recommendations by format, genre, year, rating, and country.",
};

export default function DiscoverPage() {
  return <DiscoverClient />;
}
