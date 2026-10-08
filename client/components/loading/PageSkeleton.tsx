import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageLoadingSignal } from "./LoadingScreenProvider";

export type PageSkeletonVariant =
  | "home" | "catalogue" | "detail" | "credits" | "reviews"
  | "profile" | "library" | "collection" | "moods" | "explore"
  | "search" | "people" | "person" | "auth" | "onboarding"
  | "intro" | "feed" | "quiz" | "terms";

export function LoadingRegion({ children, label = "Loading page", className = "", showMascot = false }: {
  children: ReactNode; label?: string; className?: string; showMascot?: boolean;
}) {
  return (
    <div aria-busy="true" className={className} data-loading-skeleton="true">
      <span role="status" className="sr-only">{label}</span>
      <div aria-hidden="true" className="w-full">{children}</div>
      {showMascot && <PageLoadingSignal />}
    </div>
  );
}

function Copy({ large = false }: { large?: boolean }) {
  return <div className="space-y-3">
    <Skeleton className="h-3 w-24" />
    <Skeleton className={`${large ? "h-12" : "h-9"} w-3/4 max-w-lg`} />
    <Skeleton className="h-4 w-full max-w-xl" />
    <Skeleton className="h-4 w-2/3 max-w-md" />
  </div>;
}

function Controls() {
  return <div className="flex flex-wrap gap-3">
    <Skeleton className="h-11 w-full sm:w-64" />
    <Skeleton className="h-11 w-28" />
    <Skeleton className="h-11 w-28" />
  </div>;
}

export function PosterSkeleton({ landscape = false }: { landscape?: boolean }) {
  return <div className="min-w-0">
    <Skeleton className={`${landscape ? "aspect-video" : "aspect-[2/3]"} rounded-xl`} />
    <Skeleton className="mt-3 h-4 w-4/5" />
    <Skeleton className="mt-2 h-3 w-1/3" />
  </div>;
}

export function SkeletonGrid({ count = 12, landscape = false }: { count?: number; landscape?: boolean }) {
  return <div className={landscape
    ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    : "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"}>
    {Array.from({ length: count }, (_, i) => <PosterSkeleton key={i} landscape={landscape} />)}
  </div>;
}

export function RailSkeleton({ landscape = false }: { landscape?: boolean }) {
  return <div className="overflow-hidden">
    <Skeleton className="mb-5 h-9 w-56 max-w-full" />
    <div className="flex gap-3 sm:gap-4">
      {Array.from({ length: 6 }, (_, i) => <div key={i} className={landscape ? "w-72 shrink-0 sm:w-96" : "w-36 shrink-0 sm:w-44"}>
        <PosterSkeleton landscape={landscape} />
      </div>)}
    </div>
  </div>;
}

function Hero({ detail = false }: { detail?: boolean }) {
  return <div className={detail ? "ui-shell py-10 lg:pt-36" : "landing-hero flex items-end border-b border-[var(--surface-border)] py-10 lg:pt-24"}>
    <div className={detail ? "grid gap-6 sm:grid-cols-[minmax(0,240px)_1fr] sm:gap-8" : "ui-shell w-full"}>
      {detail && <Skeleton className="aspect-[2/3] w-40 rounded-xl sm:w-full" />}
      <div className="max-w-2xl space-y-6 sm:self-center">
        <Copy large />
        <Skeleton className="h-4 w-1/2" />
        <Controls />
        {detail && <div className="grid grid-cols-3 gap-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>}
      </div>
    </div>
  </div>;
}

function Profile() {
  return <div className="space-y-6">
    <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-1)] p-4 sm:p-8">
      <div className="flex items-center gap-4">
        <Skeleton className="h-20 w-20 shrink-0 rounded-2xl sm:h-28 sm:w-28" />
        <div className="min-w-0 flex-1"><Copy /></div>
      </div>
      <Skeleton className="mt-6 h-16 rounded-xl" />
    </div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
    <Controls />
    <SkeletonGrid count={6} />
  </div>;
}

function Auth({ variant }: { variant: PageSkeletonVariant }) {
  return <div className={`mx-auto w-full space-y-6 ${variant === "intro" ? "max-w-3xl" : variant === "onboarding" ? "max-w-xl p-6" : "max-w-md"}`}>
    <Skeleton className="h-9 w-36" />
    <Copy large />
    {variant === "onboarding" ? <div className="grid grid-cols-2 gap-3">{[0, 1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      : variant === "intro" ? <Skeleton className="h-64 rounded-xl" />
        : <>{[0, 1].map(i => <div key={i} className="space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-12 w-full" /></div>)}</>}
    <Skeleton className="h-12 w-full rounded-lg" />
    <Skeleton className="mx-auto h-4 w-2/3" />
  </div>;
}

export default function PageSkeleton({ variant = "catalogue", embedded = false }: {
  variant?: PageSkeletonVariant; embedded?: boolean;
}) {
  const auth = ["auth", "intro", "onboarding"].includes(variant);
  if (auth) return <LoadingRegion showMascot label="Loading account page" className={embedded ? "w-full" : "flex min-h-[100dvh] items-center justify-center bg-[var(--surface-0)] p-6"}><Auth variant={variant} /></LoadingRegion>;
  if (variant === "feed") return <LoadingRegion showMascot label="Loading Moodies Feed" className="relative min-h-[100svh] overflow-hidden bg-[var(--surface-0)]">
    <div className="flex justify-between p-5"><Skeleton className="h-10 w-28" /><Skeleton className="h-10 w-20" /></div>
    <div className="mx-auto flex h-[75svh] max-w-xl items-end gap-6 p-6"><div className="flex-1"><Copy large /></div><div className="space-y-4">{[0, 1, 2].map(i => <Skeleton key={i} className="h-12 w-12 rounded-full" />)}</div></div>
  </LoadingRegion>;
  const bare = variant === "credits" || variant === "reviews";
  return <LoadingRegion showMascot label={`Loading ${variant === "home" ? "featured stories" : variant} page`} className="min-h-screen overflow-x-clip bg-[var(--surface-0)] text-[var(--ink)]">
    {(variant === "home" || variant === "detail") && <Hero detail={variant === "detail"} />}
    <div className={`ui-shell space-y-8 pb-16 ${variant === "home" || variant === "detail" ? "pt-8" : bare ? "pt-8" : "pt-8 lg:pt-28"}`}>
      <PageBody variant={variant} />
    </div>
  </LoadingRegion>;
}

function PageBody({ variant }: { variant: PageSkeletonVariant }) {
  switch (variant) {
    case "home":
    case "detail":
      return <><RailSkeleton /><RailSkeleton landscape /></>;
    case "profile":
      return <Profile />;
    case "person":
      return <><div className="grid gap-8 sm:grid-cols-[240px_1fr]"><Skeleton className="aspect-[2/3] w-40 rounded-xl sm:w-full" /><div className="space-y-6"><Copy large /><Skeleton className="h-40" /></div></div><RailSkeleton /></>;
    case "moods":
    case "explore":
      return <><Copy large /><div className="grid gap-8 lg:grid-cols-2"><Skeleton className="mx-auto aspect-square w-full max-w-md rounded-full" /><div className="space-y-5"><Controls /><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-12 w-40" /></div></div><RailSkeleton /></>;
    case "reviews":
      return <><Copy large /><Controls /><div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map(i => <div key={i} className="space-y-5 rounded-xl border border-[var(--surface-border)] p-5"><Skeleton className="h-10 w-10 rounded-full" /><Copy /><Skeleton className="h-16" /></div>)}</div></>;
    case "quiz":
      return <div className="mx-auto max-w-3xl space-y-6"><Copy large /><div className="grid gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}</div><Controls /></div>;
    case "terms":
      return <div className="mx-auto max-w-3xl space-y-8"><Copy large />{[0, 1, 2, 3].map(i => <div key={i} className="space-y-3"><Skeleton className="h-7 w-1/2" />{[0, 1, 2].map(j => <Skeleton key={j} className="h-4 w-full" />)}</div>)}</div>;
    default:
      return <><Copy large />{variant === "catalogue" && <Skeleton className="aspect-video rounded-xl sm:aspect-[21/9]" />}<Controls /><SkeletonGrid />{variant === "collection" && <RailSkeleton />}</>;
  }
}
