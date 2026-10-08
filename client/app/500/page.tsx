import type { Metadata } from "next";
import MoodiesErrorPage from "@/components/errors/MoodiesErrorPage";

export const metadata: Metadata = { title: "Unexpected intermission", robots: { index: false, follow: false } };

export default function ServerErrorPage() {
  return <MoodiesErrorPage status={500} />;
}
