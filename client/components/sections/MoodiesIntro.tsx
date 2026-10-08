import { BadgeMascot } from "@/components/ui/BadgeMascot";

const discoveryFeatures = [
  {
    title: "Start with a feeling",
    description:
      "Something cozy, a little thrilling, or a good laugh. Discover stories that fit your mood.",
    mascot: "mood-starter",
    mascotName: "Mood wheel guide",
  },
  {
    title: "Make it personal",
    description:
      "Your favourite genres and languages help shape recommendations around your taste.",
    mascot: "taste-maker",
    mascotName: "Your personal taste guide",
  },
  {
    title: "Get to know your next watch",
    description:
      "Explore trailers, ratings and community reviews, then save your picks to your watchlist.",
    mascot: "watchlist-builder",
    mascotName: "Watchlist builder",
  },
] as const;

type MoodiesIntroProps = {
  variant?: "landing" | "onboarding";
  headingId?: string;
};

export default function MoodiesIntro({
  variant = "landing",
  headingId = "moodies-intro-heading",
}: MoodiesIntroProps) {
  const compact = variant === "onboarding";

  if (compact) {
    return (
      <section aria-labelledby={headingId} className="relative overflow-hidden rounded-xl border border-[var(--surface-border)] bg-[var(--surface-1)] p-3 sm:p-5">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_100%_0%,rgba(230,182,92,0.12),transparent_65%)]" />
        <div className="relative grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-x-3 gap-y-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
          <div>
            <p className="ui-kicker">Meet Moodies</p>
            <h2 id={headingId} className="mt-2 text-xl font-bold leading-tight text-[var(--ink)] sm:text-2xl">Find your next good watch.</h2>
          </div>
          <BadgeMascot name="first-watch" alt="Your Moodies welcome guide" reaction="A good watch starts with you." sizes="(max-width: 639px) 96px, 144px" className="col-start-2 row-span-2 row-start-1 h-24 w-24 sm:h-36 sm:w-36" />
          <p className="col-start-1 text-sm leading-5 text-[var(--ink-muted)]">Movies and series for your mood, shaped by your taste.</p>
        </div>
        <p className="relative mt-2 border-t border-[var(--surface-border)] pt-2 text-xs leading-4 text-[var(--ink-muted)]">Find it here. Watch on your service.</p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      className={compact ? "w-full" : "ui-shell py-6 sm:py-10"}
    >
      <div
        className={`ui-panel overflow-hidden ${compact ? "p-4 sm:p-5" : "p-4 sm:p-7 lg:p-8"}`}
      >
        <div
          className={
            compact
              ? ""
              : "grid gap-5 sm:gap-7 lg:grid-cols-2 lg:items-center lg:gap-12"
          }
        >
          <div
            className="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_8rem]"
          >
            <div className="min-w-0">
              <p className="ui-kicker">What is Moodies?</p>
              <h2
                id={headingId}
                className={`mt-2 font-bold text-[var(--ink)] ${compact ? "text-xl leading-tight sm:text-2xl" : "max-w-3xl text-balance text-2xl leading-tight sm:text-4xl sm:leading-none"}`}
              >
                Your mood. Your taste. Your next watch.
              </h2>
            </div>
            <BadgeMascot
              name="first-watch"
              alt="Your Moodies welcome guide"
              sizes="(max-width: 639px) 80px, 128px"
              className="col-start-2 row-start-1 h-20 w-20 self-center sm:h-32 sm:w-32"
            />
            <p className="col-span-2 mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
              {compact ? (
                "Moodies helps you discover movies and TV shows for your mood and taste. Your favourite genres and languages personalise your picks."
              ) : (
                <>
                  <span className="sm:hidden">
                    Discover movies and series for your mood and taste.
                  </span>
                  <span className="hidden sm:inline">
                    Moodies is your movie and TV recommendation guide. Discover
                    stories curated around how you feel and personalised to your
                    favourite genres and languages.
                  </span>
                </>
              )}
            </p>
          </div>
          {!compact && (
            <ul className="hidden gap-5 sm:grid">
              {discoveryFeatures.map(
                ({ title, description, mascot, mascotName }) => (
                  <li key={title} className="flex items-start gap-4">
                    <BadgeMascot
                      name={mascot}
                      alt={mascotName}
                      sizes="56px"
                      className="h-14 w-14 shrink-0 object-contain"
                    />
                    <div>
                      <h3 className="text-base font-bold leading-tight text-[var(--ink)]">
                        {title}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
                        {description}
                      </p>
                    </div>
                  </li>
                ),
              )}
            </ul>
          )}
        </div>
        <p
          className={`border-t border-[var(--surface-border)] text-sm leading-6 text-[var(--ink-muted)] ${compact ? "mt-3 pt-3" : "mt-4 pt-3 sm:mt-6 sm:pt-4"}`}
        >
          <span className="font-semibold text-[var(--ink)]">
            Discover here. Watch on your favourite service.
          </span>{" "}
          {compact ? (
            "We provide recommendations and title information, without hosting or streaming full movies or TV episodes."
          ) : (
            <span className="hidden sm:inline">
              Moodies provides recommendations and information; we don&apos;t
              host or stream full movies or TV episodes. Enjoy your picks
              through licensed streaming services or in cinemas.
            </span>
          )}
        </p>
      </div>
    </section>
  );
}
