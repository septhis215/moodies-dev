// app/auth/AuthLayoutClient.tsx
"use client";

import { usePathname } from "next/navigation";
import AuthPoster from "./AuthPoster";

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

  if (isOnboarding) {
    return (
      <div
        className="relative z-10 w-full max-w-5xl mx-auto p-6 sm:p-8 lg:p-10 rounded-3xl
                      bg-black/55 border border-white/10
                      shadow-[0_10px_80px_-15px_rgba(0,0,0,0.9)]
                      animate-fadeIn"
      >
        {children}
      </div>
    );
  }

  return (
    <div className="relative z-10 w-full max-w-5xl mx-auto max-h-[96dvh] animate-fadeIn">
      {/* Ambient brand glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-8 -z-10 rounded-[44px]
                   bg-[radial-gradient(60%_60%_at_30%_30%,rgba(233,79,55,0.35),transparent_70%)]
                   blur-3xl opacity-70"
      />

      {/* Gradient border shell */}
      <div
        className="rounded-[28px] p-px bg-gradient-to-br from-[rgb(233,79,55)]/70 via-white/15 to-white/5
                   shadow-[0_30px_120px_-20px_rgba(0,0,0,0.95)]"
      >
        <div
          className="rounded-[27px] bg-black/65 backdrop-blur-2xl
                     p-[clamp(0.85rem,2.5vh,2.5rem)]
                     flex flex-col md:flex-row items-center gap-[clamp(1rem,3vh,2.5rem)]"
        >
          <div className="hidden md:flex w-full md:w-1/2 justify-center">
            <AuthPoster slides={slides} rotationMs={10000} />
          </div>

          {/* Divider accent */}
          <div className="hidden md:block w-px self-stretch bg-gradient-to-b from-transparent via-white/15 to-transparent" />

          <div className="w-full md:flex-1">
            <div
              className="rounded-2xl bg-white/[0.03] border border-white/10
                         p-[clamp(0.9rem,2.6vh,1.75rem)]
                         shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
