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
  void slides;

  if (pathname === "/auth/intro") {
    return (
      <div className="relative z-10 mx-auto max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-xl border border-[var(--surface-border)] bg-[var(--surface-0)]/95 p-5 sm:p-8">
        {children}
      </div>
    );
  }

  if (isOnboarding) {
    return (
      <div
        className="relative z-10 mx-auto h-[calc(100dvh-2rem)] w-full max-w-xl overflow-hidden rounded-2xl
                   border border-white/12 bg-black/58 p-0 shadow-[0_24px_100px_-28px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.08)]
                   backdrop-blur-xl animate-fadeIn md:h-[min(640px,calc(100dvh-2rem))]"
      >
        {children}
      </div>
    );
  }

  return (
    <div className="fixed inset-y-0 right-0 z-10 flex w-full md:w-[min(58vw,520px)] lg:w-[min(44vw,580px)]">
      <div
        aria-hidden
        className="auth-panel-fade pointer-events-none absolute inset-y-0 -left-24 hidden w-24 md:block"
      />

      <div
        className="auth-glass-panel relative flex min-h-[100dvh] w-full overflow-y-auto px-6 py-8
                   sm:px-8 sm:py-10 lg:px-12"
      >
        <div className="relative mx-auto flex min-h-full w-full max-w-md items-center py-3 sm:py-0">
          {children}
        </div>
      </div>
    </div>
  );
}
