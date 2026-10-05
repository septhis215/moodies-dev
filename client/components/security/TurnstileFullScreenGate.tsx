"use client";

import { useTurnstileGate } from "@/hooks/useTurnstileGate";
import { TurnstileCaptcha } from "@/components/ui/TurnstileCaptcha";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";

/** Site-entry protection using only Cloudflare's standard widget UI. */
export function TurnstileFullScreenGate() {
  const { isReleasing, verifyToken } = useTurnstileGate();

  return (
    <div
      className="fixed inset-0 z-[1000000] grid place-items-center overflow-y-auto bg-[#07090d]/96 px-4 py-8 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label="Security verification"
    >
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#101216]/95 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.6)] sm:p-8">
        <div className="flex items-center gap-3">
          <Image
            src="/images/moodies-transparent.png"
            alt="Moodies"
            width={44}
            height={44}
            className="h-10 w-10 object-contain"
            priority
          />
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[#ef775f]">
              Welcome to Moodies
            </p>
            <h1 className="text-2xl font-bold leading-none text-white sm:text-3xl">
              Quick security check
            </h1>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
          {isReleasing ? (
            <div className="flex min-h-[78px] flex-col items-center justify-center gap-2 text-center">
              <span className="grid h-9 w-9 place-items-center rounded-full border border-[#ef775f]/45 bg-[#e94f37]/15 text-xl font-bold text-[#ff9a86] shadow-[0_0_22px_rgba(233,79,55,0.2)]">
                ✓
              </span>
              <h2 className="text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl">
                Verified
              </h2>
              <span className="text-xs font-medium text-white/45">
                Welcome to Moodies
              </span>
            </div>
          ) : (
            <>
              <p className="text-sm leading-6 text-white/60">
                Please verify that you are human to continue to Moodies.
              </p>
              <div className="mt-5 flex justify-center">
                <TurnstileCaptcha
                  action="app_entry"
                  onVerify={(token) => void verifyToken(token)}
                  onClear={() => undefined}
                />
              </div>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-white/35">
          Protected by Cloudflare Turnstile
        </p>
      </div>
    </div>
  );
}
