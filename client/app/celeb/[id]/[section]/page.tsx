import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CelebrityContentPage from "@/components/celeb/CelebrityContentPage";

const titles: Record<string, string> = {
  news: "Celebrity news",
  videos: "Celebrity videos",
  photos: "Celebrity photos",
};
type Props = { params: Promise<{ id: string; section: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section } = await params;
  return {
    title: Object.hasOwn(titles, section) ? titles[section] : "Celebrity hub",
  };
}
export default async function CelebritySectionPage({ params }: Props) {
  const { id, section } = await params;
  const personId = Number(id);
  if (
    !/^\d+$/.test(id) ||
    !Number.isSafeInteger(personId) ||
    personId < 1 ||
    !["news", "videos", "photos"].includes(section)
  )
    notFound();
  return (
    <CelebrityContentPage
      id={personId}
      section={section as "news" | "videos" | "photos"}
    />
  );
}
