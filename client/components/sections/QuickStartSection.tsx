import Link from "next/link";
import {
  ArrowRight,
  Brain,
  Clapperboard,
  Heart,
  Sparkles,
  Tv,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type DiscoveryPath = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

const discoveryPaths: DiscoveryPath[] = [
  {
    label: "Movies",
    description: "Big-screen stories",
    href: "/movies",
    icon: Clapperboard,
  },
  {
    label: "Series",
    description: "Your next binge",
    href: "/tv",
    icon: Tv,
  },
  {
    label: "Moods",
    description: "Match the feeling",
    href: "/moods/explore",
    icon: Heart,
  },
  {
    label: "Personality quiz",
    description: "Find your watch style",
    href: "/quiz",
    icon: Brain,
  },
];

export default function QuickStartSection() {
  return (
    <section className="ui-shell relative z-20 py-8 sm:py-10 lg:py-12" aria-labelledby="quick-start-heading">
      <div className="ui-panel overflow-hidden">
        <div className="grid gap-7 p-5 sm:p-7 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:items-center lg:gap-10 lg:p-8">
          <div>
            <p className="ui-kicker">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Start here
            </p>
            <h2
              id="quick-start-heading"
              className="mt-3 max-w-md text-balance text-2xl font-black tracking-tight text-white sm:text-3xl"
            >
              Find a watch that fits the moment.
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-white/58 sm:text-[15px]">
              Browse with a plan or let your mood lead. Each path takes you straight to a useful starting point.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link href="/moods/explore" className="ui-primary-action">
                Find by mood
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/trending" className="ui-secondary-action">
                See what&apos;s trending
              </Link>
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2" aria-label="Discovery paths">
            {discoveryPaths.map((path) => {
              const Icon = path.icon;

              return (
                <Link
                  key={path.href}
                  href={path.href}
                  className="ui-panel-interactive group grid min-h-[5.75rem] grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 p-3.5 sm:min-h-24 sm:p-4"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-coral/12 text-brand-coral-strong ring-1 ring-brand-coral/20">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-extrabold text-white">
                      {path.label}
                    </span>
                    <span className="mt-1 block truncate text-xs text-white/45">
                      {path.description}
                    </span>
                  </span>
                  <ArrowRight
                    className="h-4 w-4 text-white/30 transition-transform group-hover:translate-x-0.5 group-hover:text-white/75"
                    aria-hidden="true"
                  />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
