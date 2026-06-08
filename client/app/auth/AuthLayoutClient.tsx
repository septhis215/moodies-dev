// app/auth/AuthLayoutClient.tsx
"use client";

import { usePathname } from "next/navigation";
type Slide = {
  title: string;
  poster: string;
  backdrop: string;
  rating?: number;
  year?: string;
  genre?: string;
  kind?: "movie" | "tv";
};

interface Props {
  slides: Slide[];
  children: React.ReactNode;
}

export default function AuthLayoutClient({ slides, children }: Props) {
  const pathname = usePathname();
  const isOnboarding = pathname.includes("onboarding");
  const isSignup = pathname.includes("/auth/signup");
  void slides;

  if (isOnboarding) {
    return (
      <div
        className="relative z-10 mx-auto h-[calc(100dvh-2rem)] w-full max-w-5xl overflow-hidden rounded-2xl
                   border border-white/12 bg-black/58 p-0 shadow-[0_24px_100px_-28px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.08)]
                   backdrop-blur-xl animate-fadeIn md:h-auto md:max-h-[calc(100dvh-2rem)] md:rounded-3xl md:p-5 lg:p-7"
      >
        {children}
      </div>
    );
  }

  return (
    <div className="fixed inset-y-0 right-0 z-10 flex w-full animate-fadeIn md:w-[min(58vw,520px)] lg:w-[min(44vw,580px)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-24 hidden w-24
                   bg-gradient-to-l from-black/40 to-transparent md:block"
      />

      <div
        className={`relative flex min-h-[100dvh] w-full ${
          isSignup ? "overflow-hidden" : "overflow-y-auto"
        }
                   border-l border-white/12 bg-black/58 px-5 py-5
                   shadow-[-28px_0_90px_-40px_rgba(0,0,0,0.95)]
                   backdrop-blur-xl sm:px-8 sm:py-6 lg:px-12`}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0
                     bg-[radial-gradient(72%_48%_at_50%_12%,rgba(233,79,55,0.18),transparent_72%)]"
        />

        <div className="relative mx-auto flex min-h-full w-full max-w-md items-center">
          {children}
        </div>
      </div>
    </div>
  );
}
