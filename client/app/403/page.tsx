import type { Metadata } from "next";
import MoodiesErrorPage from "@/components/errors/MoodiesErrorPage";

export const metadata: Metadata = { title: "Access restricted", robots: { index: false, follow: false } };

export default function AccessRestricted() {
  return <MoodiesErrorPage status={403} />;
}
