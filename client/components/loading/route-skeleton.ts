import type { PageSkeletonVariant } from "./PageSkeleton";

/** Shared by session bootstrap and the route coverage check. */
export function skeletonForPath(pathname: string): PageSkeletonVariant {
  const parts = pathname.split("/").filter(Boolean);
  const [root, child, section] = parts;
  if (!root || ((root === "movies" || root === "tv") && !child)) return "home";
  if (root === "auth") return child === "intro" ? "intro" : child === "onboarding" ? "onboarding" : "auth";
  if (root === "movies" || root === "tv") {
    if (section === "credits" || section === "reviews") return section;
    const shelves = ["featured", "new-releases", "box-office", "award-winners", "indie", "animated", "korean-cinema", "action", "trending", "top-rated", "airing", "k-drama"];
    return shelves.includes(child) ? "catalogue" : "detail";
  }
  if (root === "celeb") return child ? "person" : "people";
  if (root === "profile") return "profile";
  if (root === "watchlist" || root === "liked") return "library";
  if (root === "moods") return child === "explore" ? "explore" : "moods";
  if (root === "collection" || root === "search" || root === "feed" || root === "quiz" || root === "terms") return root;
  return "catalogue";
}
