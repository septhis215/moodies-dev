import { TmdbImage as Image } from "@/components/ui/TmdbImage";

const discoveryFeatures = [
  {
    title: "Start with a feeling",
    description:
      "Something cozy, a little thrilling, or a good laugh. Discover stories that fit your mood.",
    mascot: "romantic",
    mascotName: "Romantic",
  },
  {
    title: "Make it personal",
    description:
      "Your favourite genres and languages help shape recommendations around your taste.",
    mascot: "sci-fi",
    mascotName: "Sci-Fi",
  },
  {
    title: "Get to know your next watch",
    description:
      "Explore trailers, ratings and community reviews, then save your picks to your watchlist.",
    mascot: "documentary",
    mascotName: "Documentary",
  },
];

type MoodiesIntroProps = {
  variant?: "landing" | "onboarding";
  headingId?: string;
};

export default function MoodiesIntro({
  variant = "landing",
  headingId = "moodies-intro-heading",
}: MoodiesIntroProps) {
  const compact = variant === "onboarding";

  return (
    <section
      aria-labelledby={headingId}
      className={compact ? "w-full" : "ui-shell py-8 sm:py-10"}
    >
      <div
        className={`ui-panel overflow-hidden ${compact ? "p-4 sm:p-5" : "p-5 sm:p-7 lg:p-8"}`}
      >
        <div
          className={
            compact ? "" : "grid gap-7 lg:grid-cols-2 lg:items-center lg:gap-12"
          }
        >
          <div
            className={`grid items-center gap-x-4 gap-y-2 ${compact ? "grid-cols-[minmax(0,1fr)_4rem]" : "grid-cols-[minmax(0,1fr)_5rem] sm:grid-cols-[minmax(0,1fr)_8rem]"}`}
          >
            <div className={compact ? "" : "contents sm:block"}>
              <p className="ui-kicker">What is Moodies?</p>
              <h2
                id={headingId}
                className={`mt-2 font-bold text-[var(--ink)] ${compact ? "text-xl leading-tight sm:text-2xl" : "col-span-2 max-w-3xl text-balance text-3xl leading-none sm:text-4xl"}`}
              >
                Your mood. Your taste. Your next watch.
              </h2>
            </div>
            <Image
              src="/images/moods/serenity.png"
              alt="Serenity mood mascot"
              width={160}
              height={160}
              unoptimized
              sizes={compact ? "64px" : "(max-width: 639px) 80px, 128px"}
              className={`object-contain ${compact ? "h-16 w-16" : "col-start-2 row-start-1 h-20 w-20 sm:h-32 sm:w-32"}`}
            />
            <p className="col-span-2 mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
              {compact
                ? "Moodies helps you discover movies and TV shows for your mood and taste. Your favourite genres and languages personalise your picks."
                : "Moodies is your movie and TV recommendation guide. Discover stories curated around how you feel and personalised to your favourite genres and languages."}
            </p>
          </div>
          {!compact && (
            <ul className="grid gap-5">
              {discoveryFeatures.map(
                ({ title, description, mascot, mascotName }) => (
                  <li key={title} className="flex items-start gap-4">
                    <Image
                      src={`/images/moods/${mascot}.png`}
                      alt={`${mascotName} mood mascot`}
                      width={64}
                      height={64}
                      unoptimized
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
          className={`border-t border-[var(--surface-border)] text-sm leading-6 text-[var(--ink-muted)] ${compact ? "mt-3 pt-3" : "mt-6 pt-4"}`}
        >
          <span className="font-semibold text-[var(--ink)]">
            Discover here. Watch on your favourite service.
          </span>{" "}
          {compact
            ? "We provide recommendations and title information, without hosting or streaming full movies or TV episodes."
            : "Moodies provides recommendations and information; we don't host or stream full movies or TV episodes. Enjoy your picks through licensed streaming services or in cinemas."}
        </p>
      </div>
    </section>
  );
}
