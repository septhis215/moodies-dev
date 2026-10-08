"use client";

import type { All } from "@/types/all";
import type { CommunityPulseData } from "@/types/communityPulse";
import { useRecoverableSection } from "@/hooks/useRecoverableSection";
import { pulseEndpoint, upcomingEndpoint, readCommunityPulse, readUpcomingMovies, readUpcomingTV, type HomepageMediaType } from "@/lib/homepage-sections";
import { CommunityPulseSection } from "./CommunityPulseSection";
import { ComingSoonSection } from "./ComingSoon";

export function CommunityPulseClient({ initialData, mediaType }: { initialData: CommunityPulseData | null; mediaType: HomepageMediaType }) {
  const state = useRecoverableSection(initialData, pulseEndpoint(mediaType), readCommunityPulse);
  return <CommunityPulseSection data={state.data ?? undefined} mediaType={mediaType} isLoading={state.loading}
    error={state.error ? "We couldn’t load community activity. Try again in a moment." : null} onRetry={state.retry} />;
}

export function UpcomingReleasesClient({ initialData, mediaType }: { initialData: All[] | null; mediaType: HomepageMediaType }) {
  const state = useRecoverableSection(initialData, upcomingEndpoint(mediaType), mediaType === "tv" ? readUpcomingTV : readUpcomingMovies);
  return <ComingSoonSection title={mediaType === "tv" ? "Premiering soon" : "Coming to Theaters"}
    type={mediaType === "tv" ? "tv" : "movies"} items={state.data ?? []} isLoading={state.loading}
    error={state.error ? "We couldn’t load upcoming releases. Try again in a moment." : null} onRetry={state.retry} />;
}
