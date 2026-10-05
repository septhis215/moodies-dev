import {
  IconMoodSmile,
  IconAdjustmentsHorizontal,
  IconMovie,
} from "@tabler/icons-react";

const discoveryFeatures = [
  {
    title: "Start with a feeling",
    description:
      "Something cozy, a little thrilling, or a good laugh. Discover stories that fit your mood.",
    icon: IconMoodSmile,
  },
  {
    title: "Make it personal",
    description:
      "Your favourite genres and languages help shape recommendations around your taste.",
    icon: IconAdjustmentsHorizontal,
  },
  {
    title: "Get to know your next watch",
    description:
      "Explore trailers, ratings and community reviews, then save your picks to your watchlist.",
    icon: IconMovie,
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
          <div>
            <p className="ui-kicker">What is Moodies?</p>
            <h2
              id={headingId}
              className={`mt-2 font-bold text-[var(--ink)] ${compact ? "text-xl leading-tight sm:text-2xl" : "max-w-3xl text-balance text-3xl leading-none sm:text-4xl"}`}
            >
              Your mood. Your taste. Your next watch.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
              {compact
                ? "Moodies helps you discover movies and TV shows for your mood and taste. Your favourite genres and languages personalise your picks."
                : "Moodies is your movie and TV recommendation guide. Discover stories curated around how you feel and personalised to your favourite genres and languages."}
            </p>
          </div>
          {!compact && (
            <ul className="grid gap-5">
              {discoveryFeatures.map(({ title, description, icon: Icon }) => (
                <li key={title} className="flex items-start gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--surface-border)] bg-[var(--surface-2)] text-[var(--brand-coral-strong)]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold leading-tight text-[var(--ink)]">
                      {title}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
                      {description}
                    </p>
                  </div>
                </li>
              ))}
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
