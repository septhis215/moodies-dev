import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommunityThread } from "@/components/community/CommunityThread";

export const metadata: Metadata = {
  title: "Community discussion",
  description: "Join the conversation with the Moodies community.",
};

export default async function CommunityDiscussionPage({
  params,
  searchParams,
}: {
  params: Promise<{ postId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { postId } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      postId,
    )
  )
    notFound();
  const { page: requestedPage } = await searchParams;
  const number = Number(requestedPage ?? 1);
  const page =
    Number.isInteger(number) && number > 0 && number <= 10000 ? number : 1;
  return <CommunityThread key={postId} postId={postId} page={page} />;
}
