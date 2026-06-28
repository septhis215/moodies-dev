"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { handleAppError } from "@/lib/errors";
import { appToast, TOAST_IDS } from "@/lib/toast";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const GENRE_OPTIONS = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Mystery",
  "Romance",
  "Science Fiction",
  "TV Movie",
  "Thriller",
  "War",
  "Western",
  "Action & Adventure",
  "Kids",
  "News",
  "Reality",
  "Sci-Fi & Fantasy",
  "Soap",
  "Talk",
  "War & Politics",
] as const;

const LANGUAGE_OPTIONS = [
  "English",
  "French",
  "Spanish",
  "Japanese",
  "German",
  "Portuguese",
  "Chinese",
  "Italian",
  "Russian",
  "Korean",
  "Czech",
  "Arabic",
  "Dutch",
] as const;

const STEPS = ["age", "genres", "languages"] as const;
type Step = (typeof STEPS)[number];

// ── Shared chip ──────────────────────────────────────────────
interface ChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function Chip({ label, active, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-150 whitespace-nowrap select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[rgb(233,79,55)]/35",
        active
          ? "border-[rgb(233,79,55)] bg-[rgb(233,79,55)] text-white shadow-[0_8px_22px_rgba(233,79,55,0.24)]"
          : "border-white/10 bg-white/[0.045] text-white/56 hover:border-white/20 hover:bg-white/[0.08] hover:text-white/88",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

// ── Section label ─────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[0.66rem] font-bold uppercase tracking-[0.16em] text-white/36">
      {children}
    </p>
  );
}

// ── Submit button ─────────────────────────────────────────────
interface SubmitButtonProps {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

function SubmitButton({
  disabled,
  onClick,
  children,
  className = "",
}: SubmitButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "h-11 rounded-xl px-6 text-sm font-bold text-white transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-[rgb(233,79,55)]/20",
        "font-['Bebas_Neue'] tracking-widest",
        disabled
          ? "bg-white/[0.07] text-white/20 cursor-not-allowed shadow-none"
          : "bg-[rgb(233,79,55)] hover:bg-[rgb(215,65,42)] shadow-[0_4px_20px_rgba(233,79,55,0.35)] hover:shadow-[0_8px_24px_rgba(233,79,55,0.4)] hover:scale-[1.01] active:scale-[0.99] cursor-pointer",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// ── Age range slider ──────────────────────────────────────────
interface AgeSliderProps {
  value: number;
  onChange: (v: number) => void;
}

function AgeSlider({ value, onChange }: AgeSliderProps) {
  return (
    <div className="w-full">
      <input
        type="range"
        min={1}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="ob-range w-full"
      />
      <div className="mt-2 flex justify-between text-[0.62rem] text-white/25">
        {["1", "25", "50", "75", "100"].map((v) => (
          <span key={v}>{v}</span>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function OnboardingPage() {
  const { signIn, isLoading: authLoading } = useAuth();

  const [age, setAge] = useState<number>(18);
  const [genres, setGenres] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mobileStep, setMobileStep] = useState<Step>("age");

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    list.includes(v) ? set(list.filter((x) => x !== v)) : set([...list, v]);

  const canSubmit = useMemo(
    () => age >= 1 && age <= 100 && genres.length > 0 && languages.length > 0,
    [age, genres.length, languages.length],
  );

  const handleSubmit = async () => {
    if (isSubmitting || authLoading) return;
    setIsSubmitting(true);
    try {
      const pendingSignup = sessionStorage.getItem("pendingSignup");
      if (pendingSignup) {
        const { username, email, password } = JSON.parse(pendingSignup);
        appToast.loading("Creating your account...", {
          id: "onboarding-account-create",
          title: "Almost there!",
        });
        // signup sets the session cookie on this response.
        const signupRes = await fetch(`${API_BASE}/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username, email, password }),
        });
        const signupData = await signupRes.json();
        if (!signupRes.ok)
          throw new Error(signupData.message || "Sign up failed");
        // Authenticated via cookie now — save prefs with credentials.
        const prefsRes = await fetch(`${API_BASE}/auth/me/preferences`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            age,
            preferredGenres: genres,
            preferredLanguages: languages,
          }),
        });
        const prefsData = await prefsRes.json();
        if (!prefsRes.ok)
          throw new Error(prefsData.message || "Failed to save preferences");
        sessionStorage.removeItem("pendingSignup");
        appToast.success("Account created. Welcome to Moodies!", {
          id: "onboarding-account-create",
          title: "All done!",
          duration: 2500,
        });
        await new Promise((r) => setTimeout(r, 800));
        await signIn(email, password);
      } else {
        appToast.loading("Saving your preferences...", {
          id: "onboarding-preferences",
          title: "Setting up your profile",
        });
        const res = await fetch(`${API_BASE}/auth/me/preferences`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            age,
            preferredGenres: genres,
            preferredLanguages: languages,
          }),
        });
        if (res.status === 401 || res.status === 498) {
          appToast.dismiss("onboarding-preferences");
          appToast.error("Your session expired. Please log in again.", {
            id: TOAST_IDS.authSessionExpired,
            title: "Authentication error",
          });
          return;
        }
        const data = await res.json();
        if (!res.ok)
          throw new Error(data.message || "Failed to save preferences");
        appToast.success("Setup complete. Welcome to Moodies!", {
          id: "onboarding-preferences",
          title: "You're all set",
          duration: 2500,
        });
        await new Promise((r) => setTimeout(r, 800));
        window.location.href = "/";
      }
    } catch (err: unknown) {
      appToast.dismiss("onboarding-account-create");
      appToast.dismiss("onboarding-preferences");
      handleAppError(err, {
        fallbackMessage: "Could not finish onboarding. Please try again.",
        toastTitle: "Onboarding",
        toastKey: "onboarding-submit-error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const mobileStepIndex = STEPS.indexOf(mobileStep);
  const canAdvanceMobile =
    mobileStep === "age"
      ? age >= 1 && age <= 100
      : mobileStep === "genres"
        ? genres.length > 0
        : languages.length > 0;

  const processingLabel = isSubmitting || authLoading;

  return (
    <>
      {/* Range slider global style — minimal, can't do pseudo-elements in Tailwind */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
        .ob-range {
          appearance: none; -webkit-appearance: none;
          height: 8px; border-radius: 9999px;
          background: linear-gradient(90deg, rgba(233,79,55,0.65), rgba(233,79,55,0.18));
          outline: none; cursor: pointer;
          border: 1px solid rgba(255,255,255,0.08);
        }
        .ob-range::-webkit-slider-thumb {
          appearance: none; width: 22px; height: 22px;
          border-radius: 50%; background: rgb(233,79,55);
          border: 3px solid rgba(255,255,255,0.88);
          box-shadow: 0 0 0 4px rgba(233,79,55,0.22), 0 8px 24px rgba(0,0,0,0.35);
          transition: transform 0.15s;
        }
        .ob-range::-webkit-slider-thumb:hover { transform: scale(1.15); }
        .ob-range::-moz-range-thumb {
          width: 22px; height: 22px; border-radius: 50%;
          background: rgb(233,79,55); border: 3px solid rgba(255,255,255,0.88);
          box-shadow: 0 0 0 4px rgba(233,79,55,0.22), 0 8px 24px rgba(0,0,0,0.35);
        }
        .ob-scroll::-webkit-scrollbar { width: 4px; }
        .ob-scroll::-webkit-scrollbar-track { background: transparent; }
        .ob-scroll::-webkit-scrollbar-thumb { background: rgba(233,79,55,0.38); border-radius: 99px; }
        .ob-fadein { animation: obFadeUp 0.45s cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes obFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ob-stepin { animation: obStepIn 0.27s cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes obStepIn {
          from { opacity: 0; transform: translateX(18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* ═══════════════════════════════════════════════
          DESKTOP (≥ 768px) — horizontal 3-column card
      ═══════════════════════════════════════════════ */}
      <div className="ob-fadein hidden w-full max-w-[920px] flex-col mx-auto font-['DM_Sans'] md:flex">
        {/* Header */}
        <div className="mb-5 lg:mb-6">
          <h1 className="font-['Bebas_Neue'] text-[2.2rem] leading-none tracking-[0.03em] text-[rgb(233,79,55)] lg:text-[2.45rem]">
            Set up your profile
          </h1>
          <div className="mt-2.5 mb-2 h-0.5 w-12 rounded-full bg-[rgb(233,79,55)] shadow-[0_0_20px_rgba(233,79,55,0.55)]" />
          <p className="text-sm leading-5 text-white/52">
            Personalize your experience. Change it anytime in Settings.
          </p>
        </div>

        {/* 3-column card */}
        <div
          className="overflow-hidden rounded-3xl border border-white/12 border-t-white/18 shadow-[0_24px_80px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.06)]"
          style={{
            height: "min(470px, calc(100dvh - 200px))",
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), radial-gradient(circle at 20% 0%, rgba(233,79,55,0.13), transparent 38%), linear-gradient(rgba(12,12,12,0.94), rgba(12,12,12,0.94))",
            backgroundSize: "20px 20px, 100% 100%, 100% 100%",
          }}
        >
          <div className="grid h-[calc(100%-76px)] min-h-0 grid-cols-3">
            {/* Col 1 — Age */}
            <div className="flex flex-col border-r border-white/[0.07] p-5 lg:p-6">
              <SectionLabel>Your Age</SectionLabel>
              <div className="mb-5">
                <div className="font-['Bebas_Neue'] text-[4.6rem] leading-none tracking-[0.04em] text-[rgb(233,79,55)] lg:text-[5.2rem]">
                  {age}
                </div>
                <div className="mt-1 text-[0.66rem] uppercase tracking-[0.16em] text-white/32">
                  years old
                </div>
              </div>
              <div className="mt-auto">
                <AgeSlider value={age} onChange={setAge} />
              </div>
            </div>

            {/* Col 2 — Genres */}
            <div className="flex min-h-0 flex-col border-r border-white/[0.07] p-5 lg:p-6">
              <div className="flex items-center justify-between mb-3">
                <SectionLabel>Preferred Genres</SectionLabel>
                {genres.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setGenres([])}
                    className="bg-transparent p-0 text-[0.72rem] font-medium text-amber-300 transition-colors hover:text-amber-200"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="ob-scroll flex flex-1 flex-wrap content-start gap-1.5 overflow-y-auto pr-1">
                {GENRE_OPTIONS.map((g) => (
                  <Chip
                    key={g}
                    label={g}
                    active={genres.includes(g)}
                    onClick={() => toggle(genres, setGenres, g)}
                  />
                ))}
              </div>
            </div>

            {/* Col 3 — Languages */}
            <div className="flex min-h-0 flex-col p-5 lg:p-6">
              <div className="flex items-center justify-between mb-3">
                <SectionLabel>Preferred Languages</SectionLabel>
                {languages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setLanguages([])}
                    className="bg-transparent p-0 text-[0.72rem] font-medium text-amber-300 transition-colors hover:text-amber-200"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="ob-scroll flex flex-1 flex-wrap content-start gap-1.5 overflow-y-auto pr-1">
                {LANGUAGE_OPTIONS.map((l) => (
                  <Chip
                    key={l}
                    label={l}
                    active={languages.includes(l)}
                    onClick={() => toggle(languages, setLanguages, l)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Card footer */}
          <div className="flex items-center justify-between gap-4 border-t border-white/[0.08] px-5 py-4 lg:px-6">
            <div className="flex gap-6 text-[0.78rem] text-white/42">
              <span>
                <strong className="text-[rgb(233,79,55)] font-bold">
                  {genres.length}
                </strong>{" "}
                genre{genres.length !== 1 ? "s" : ""} selected
              </span>
              <span>
                <strong className="text-[rgb(233,79,55)] font-bold">
                  {languages.length}
                </strong>{" "}
                language{languages.length !== 1 ? "s" : ""} selected
              </span>
            </div>
            <SubmitButton
              disabled={!canSubmit || isSubmitting || authLoading}
              onClick={handleSubmit}
              className="min-w-[180px] text-center"
            >
              {processingLabel ? "Processing..." : "Save & Enter Moodies"}
            </SubmitButton>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          MOBILE (< 768px) — 3-step vertical wizard
      ═══════════════════════════════════════════════ */}
      <div
        className="ob-fadein relative flex min-h-full flex-col bg-[#090909] font-['DM_Sans'] md:hidden"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), radial-gradient(circle at 50% 0%, rgba(233,79,55,0.16), transparent 42%)",
          backgroundSize: "24px 24px, 100% 100%",
        }}
      >
        {/* Top red accent line */}
        <div className="absolute left-0 right-0 top-0 z-50 h-0.5 bg-[rgb(233,79,55)] opacity-80" />

        {/* Top bar */}
        <div className="flex flex-shrink-0 items-center justify-between px-5 pt-5">
          <div className="flex items-center gap-2 font-['Bebas_Neue'] text-xl tracking-[0.22em] text-white">
            <div className="h-2 w-2 rounded-full bg-[rgb(233,79,55)] shadow-[0_0_16px_rgba(233,79,55,0.65)]" />
            Moodies
          </div>
          <div className="flex gap-1.5">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={[
                  "h-1 rounded-full transition-all duration-300",
                  i < mobileStepIndex
                    ? "w-7 bg-[rgba(233,79,55,0.42)]"
                    : i === mobileStepIndex
                      ? "w-10 bg-[rgb(233,79,55)] shadow-[0_0_14px_rgba(233,79,55,0.35)]"
                      : "w-7 bg-white/10",
                ].join(" ")}
              />
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="ob-scroll flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-4 pt-7">
          {/* Step 1 — Age */}
          {mobileStep === "age" && (
            <div className="ob-stepin flex flex-1 flex-col">
              <p className="mb-2 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[rgb(233,79,55)]">
                Step 1 of 3
              </p>
              <h2 className="mb-2 font-['Bebas_Neue'] text-[2.35rem] leading-none tracking-[0.02em] text-white">
                How old
                <br />
                are you?
              </h2>
              <p className="mb-7 text-sm leading-5 text-white/48">
                Helps us match content ratings to you.
              </p>
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] py-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="font-['Bebas_Neue'] text-[6.4rem] leading-none tracking-[0.04em] text-[rgb(233,79,55)]">
                  {age}
                </div>
                <div className="mt-1 text-[0.68rem] uppercase tracking-[0.16em] text-white/32">
                  years old
                </div>
              </div>
              <div className="mt-auto pt-7">
                <AgeSlider value={age} onChange={setAge} />
              </div>
            </div>
          )}

          {/* Step 2 — Genres */}
          {mobileStep === "genres" && (
            <div className="ob-stepin flex flex-1 flex-col">
              <p className="mb-2 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[rgb(233,79,55)]">
                Step 2 of 3
              </p>
              <h2 className="mb-2 font-['Bebas_Neue'] text-[2.35rem] leading-none tracking-[0.02em] text-white">
                What do
                <br />
                you watch?
              </h2>
              <p className="mb-4 text-sm leading-5 text-white/48">
                Pick as many genres as you like.
              </p>
              <div className="mb-3 flex items-center gap-2 text-[0.75rem] text-white/42">
                <strong className="text-[rgb(233,79,55)] font-bold">
                  {genres.length}
                </strong>{" "}
                selected
                {genres.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setGenres([])}
                    className="bg-transparent p-0 text-[0.72rem] font-medium text-amber-300 transition-colors hover:text-amber-200"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 pb-2">
                {GENRE_OPTIONS.map((g) => (
                  <Chip
                    key={g}
                    label={g}
                    active={genres.includes(g)}
                    onClick={() => toggle(genres, setGenres, g)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Step 3 — Languages */}
          {mobileStep === "languages" && (
            <div className="ob-stepin flex flex-1 flex-col">
              <p className="mb-2 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[rgb(233,79,55)]">
                Step 3 of 3
              </p>
              <h2 className="mb-2 font-['Bebas_Neue'] text-[2.35rem] leading-none tracking-[0.02em] text-white">
                Preferred
                <br />
                languages?
              </h2>
              <p className="mb-4 text-sm leading-5 text-white/48">
                We will prioritize content in these languages.
              </p>
              <div className="mb-3 flex items-center gap-2 text-[0.75rem] text-white/42">
                <strong className="text-[rgb(233,79,55)] font-bold">
                  {languages.length}
                </strong>{" "}
                selected
                {languages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setLanguages([])}
                    className="bg-transparent p-0 text-[0.72rem] font-medium text-amber-300 transition-colors hover:text-amber-200"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 pb-2">
                {LANGUAGE_OPTIONS.map((l) => (
                  <Chip
                    key={l}
                    label={l}
                    active={languages.includes(l)}
                    onClick={() => toggle(languages, setLanguages, l)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="flex-shrink-0 border-t border-white/10 bg-black/28 px-5 pb-5 pt-3 backdrop-blur">
          <div className="flex gap-2.5">
            {mobileStepIndex > 0 && (
              <button
                type="button"
                onClick={() => setMobileStep(STEPS[mobileStepIndex - 1])}
                className="h-11 rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm font-semibold text-white/48 transition-all hover:border-white/22 hover:text-white/78"
              >
                Back
              </button>
            )}
            {mobileStep !== "languages" ? (
              <button
                type="button"
                disabled={!canAdvanceMobile}
                onClick={() => setMobileStep(STEPS[mobileStepIndex + 1])}
                className={[
                  "h-11 flex-1 rounded-xl font-['Bebas_Neue'] text-[0.95rem] tracking-widest transition-all",
                  canAdvanceMobile
                    ? "bg-[rgb(233,79,55)] text-white shadow-[0_4px_16px_rgba(233,79,55,0.28)] hover:bg-[rgb(215,65,42)] active:scale-[0.98] cursor-pointer"
                    : "bg-white/[0.07] text-white/20 cursor-not-allowed",
                ].join(" ")}
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                disabled={!canSubmit || isSubmitting || authLoading}
                onClick={handleSubmit}
                className={[
                  "h-11 flex-1 rounded-xl font-['Bebas_Neue'] text-[0.95rem] tracking-widest transition-all",
                  canSubmit && !isSubmitting && !authLoading
                    ? "bg-[rgb(233,79,55)] text-white shadow-[0_4px_16px_rgba(233,79,55,0.28)] hover:bg-[rgb(215,65,42)] active:scale-[0.98] cursor-pointer"
                    : "bg-white/[0.07] text-white/20 cursor-not-allowed",
                ].join(" ")}
              >
                {processingLabel ? "Processing..." : "Finish Setup"}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
