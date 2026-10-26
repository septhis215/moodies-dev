import type { Metadata } from "next";
import CommunityForum from "@/components/community/CommunityForum";

export const metadata: Metadata = {
  title: "Community",
  description:
    "Share feedback about Moodies, suggest ideas, and join the community conversation.",
};

export default function CommunityPage() {
  return <CommunityForum />;
}
