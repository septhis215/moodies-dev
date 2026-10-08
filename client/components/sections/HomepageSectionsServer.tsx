import { Suspense } from "react";
import { CommunityPulseClient, UpcomingReleasesClient } from "./HomepageSectionsClient";
import { CommunityPulseSection } from "./CommunityPulseSection";
import { ComingSoonSection } from "./ComingSoon";
import { pulseEndpoint, upcomingEndpoint, readCommunityPulse, readUpcomingReleases, type HomepageMediaType } from "@/lib/homepage-sections";

/** Slow, noncritical sections stream independently and never masquerade as empty on failure. */
async function loadSection<T>(endpoint: string, decode: (payload: unknown) => T): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const base = (process.env.NEST_API_URL || "https://dev.api.moodies.tech/api").replace(/\/$/, "");
    // Nest/TMDB already cache these public resources. Avoid persisting a failed
    // or partial 200 response in a second frontend cache for another minute.
    const response = await fetch(`${base}${endpoint}`, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return decode(await response.json());
  } catch (error) {
    console.error(`Homepage section failed: ${endpoint}`, error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function PulseResult({ result, mediaType }: { result: ReturnType<typeof loadSection<ReturnType<typeof readCommunityPulse>>>; mediaType: HomepageMediaType }) {
  return <CommunityPulseClient initialData={await result} mediaType={mediaType} />;
}

async function UpcomingResult({ result, mediaType }: { result: ReturnType<typeof loadSection<ReturnType<typeof readUpcomingReleases>>>; mediaType: HomepageMediaType }) {
  return <UpcomingReleasesClient initialData={await result} mediaType={mediaType} />;
}

/** Start requests before awaiting the core homepage data; pass these ReactNode slots to its client shell. */
export function homepageSections(mediaType: HomepageMediaType) {
  const pulse = loadSection(pulseEndpoint(mediaType), readCommunityPulse);
  const upcoming = loadSection(upcomingEndpoint(mediaType), payload => readUpcomingReleases(payload, mediaType));
  return {
    communityPulse: <Suspense fallback={<CommunityPulseSection mediaType={mediaType} isLoading />}>
      <PulseResult result={pulse} mediaType={mediaType} />
    </Suspense>,
    upcoming: <Suspense fallback={<ComingSoonSection title={mediaType === "tv" ? "Premiering soon" : "Coming to Theaters"} type={mediaType === "tv" ? "tv" : "movies"} items={[]} isLoading />}>
      <UpcomingResult result={upcoming} mediaType={mediaType} />
    </Suspense>,
  };
}
