import type { Metadata } from "next";
import AchievementsPage from "@/components/achievements/AchievementsPage";
export const metadata: Metadata = {
  title: "Your achievements",
  description: "Your Moodies milestones and earned badges.",
  robots: { index: false },
};
export default function Page() {
  return <AchievementsPage />;
}
