import Link from "next/link";
import { TmdbImage } from "@/components/ui/TmdbImage";
import type { CommunityAuthor } from "@/lib/api/community";

export function communityDate(value: string) {
  return new Date(value).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function CommunityAvatar({
  user,
  large = false,
}: {
  user: CommunityAuthor;
  large?: boolean;
}) {
  return (
    <Link
      href={`/profile/${encodeURIComponent(user.id)}`}
      aria-label={`View ${user.username}'s profile`}
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--surface-border)] bg-[var(--surface-2)] font-semibold text-[var(--brand-coral-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral-strong)] ${large ? "h-14 w-14 text-xl" : "h-11 w-11 text-sm"}`}
    >
      {user.avatarUrl ? (
        <TmdbImage
          src={user.avatarUrl}
          alt=""
          width={large ? 56 : 44}
          height={large ? 56 : 44}
          unoptimized
          className="h-full w-full object-cover"
        />
      ) : (
        user.username.charAt(0).toUpperCase()
      )}
    </Link>
  );
}
