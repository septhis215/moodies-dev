// app/auth/AuthLayoutClient.tsx
"use client";

import { usePathname } from "next/navigation";
import AuthPoster from "./AuthPoster";

type Slide = { title: string; poster: string; backdrop: string };

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
    <div
      className="relative z-10 w-full max-w-5xl mx-auto p-4 sm:p-6 lg:p-10 rounded-3xl
                    bg-black/55 backdrop-blur-xl border border-white/10
                    shadow-[0_10px_80px_-15px_rgba(0,0,0,0.9)]
                    flex flex-col md:flex-row items-center gap-8 animate-fadeIn"
    >
      <div className="hidden md:flex w-full md:w-1/2 justify-center">
        <AuthPoster slides={slides} rotationMs={10000} />
      </div>
      <div className="w-full md:w-1/2">
        <div className="rounded-2xl bg-black/35 border border-white/10 p-5 sm:p-7">
          {children}
        </div>
      </div>
    </div>
  );
}
