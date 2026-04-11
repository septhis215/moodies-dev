"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/app/context/ToastContext";
import { useAuth } from "@/hooks/useAuth";
import { sGet, sSet } from "@/utils/secureStorage";

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
        "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 whitespace-nowrap select-none cursor-pointer",
        active
          ? "bg-[rgb(233,79,55)] text-white border-[rgb(233,79,55)] shadow-[0_2px_10px_rgba(233,79,55,0.3)]"
          : "bg-white/[0.04] text-white/50 border-white/10 hover:bg-white/[0.08] hover:text-white/85 hover:border-white/20",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

// ── Section label ─────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.62rem] font-bold tracking-[0.14em] uppercase text-white/30 mb-3">
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
        "px-6 py-2.5 rounded-lg font-bold text-sm text-white transition-all duration-200",
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
      <div className="flex justify-between mt-1.5 text-[0.6rem] text-white/20">
        {["1", "25", "50", "75", "100"].map((v) => (
          <span key={v}>{v}</span>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function OnboardingPage() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { signIn, isLoading: authLoading } = useAuth();

  const [age, setAge] = useState<number>(18);
  const [genres, setGenres] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mobileStep, setMobileStep] = useState<Step>("age");

  useEffect(() => {
    const urlToken = searchParams.get("token");
    if (urlToken) {
      sSet("authToken", urlToken);
      sSet("authTokenExpiry", String(Date.now() + 86400000));
      window.history.replaceState({}, document.title, window.location.pathname);
      toast(
        "Connected with Google! Now set your preferences.",
        "success",
        3000,
        "Almost there",
        null,
      );
    }
  }, [searchParams, toast]);

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
        toast("Creating your account...", "info", 3000, "Almost there!", null);
        const signupRes = await fetch(`${API_BASE}/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, email, password }),
        });
        const signupData = await signupRes.json();
        if (!signupRes.ok)
          throw new Error(signupData.message || "Sign up failed");
        const token = signupData.token;
        sSet("authToken", token);
        sSet("authTokenExpiry", String(Date.now() + 86400000));
        const prefsRes = await fetch(`${API_BASE}/auth/me/preferences`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
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
        toast(
          "Account created! Welcome to Moodies!",
          "success",
          2000,
          "All done!",
          null,
        );
        await new Promise((r) => setTimeout(r, 800));
        await signIn(email, password);
      } else {
        const token = sGet("authToken");
        if (!token) {
          toast("Not logged in!", "error", 3000, "Authentication Error", null);
          return;
        }
        toast(
          "Saving your preferences...",
          "info",
          3000,
          "Setting Up Your Profile",
          null,
        );
        const res = await fetch(`${API_BASE}/auth/me/preferences`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            age,
            preferredGenres: genres,
            preferredLanguages: languages,
          }),
        });
        const data = await res.json();
        if (!res.ok)
          throw new Error(data.message || "Failed to save preferences");
        toast(
          "Setup complete! Welcome to Moodies!",
          "success",
          2000,
          "You're all set",
          null,
        );
        await new Promise((r) => setTimeout(r, 800));
        window.location.href = "/";
      }
    } catch (err: any) {
      toast(err.message || "An error occurred", "error", 4000, "Error", null);
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
          height: 6px; border-radius: 9999px;
          background: rgba(233,79,55,0.18);
          outline: none; cursor: pointer;
        }
        .ob-range::-webkit-slider-thumb {
          appearance: none; width: 20px; height: 20px;
          border-radius: 50%; background: rgb(233,79,55);
          box-shadow: 0 0 0 3px rgba(233,79,55,0.22);
          transition: transform 0.15s;
        }
        .ob-range::-webkit-slider-thumb:hover { transform: scale(1.15); }
        .ob-range::-moz-range-thumb {
          width: 20px; height: 20px; border-radius: 50%;
          background: rgb(233,79,55); border: none;
          box-shadow: 0 0 0 3px rgba(233,79,55,0.22);
        }
        .ob-scroll::-webkit-scrollbar { width: 3px; }
        .ob-scroll::-webkit-scrollbar-track { background: transparent; }
        .ob-scroll::-webkit-scrollbar-thumb { background: rgba(233,79,55,0.35); border-radius: 99px; }
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
      <div className="ob-fadein hidden md:flex flex-col w-full max-w-[860px] mx-auto py-8 font-['DM_Sans']">
        {/* Header */}
        <div className="mb-7">
          <h1 className="font-['Bebas_Neue'] text-[2.4rem] tracking-[0.03em] leading-none text-[rgb(233,79,55)]">
            Set up your profile
          </h1>
          <div className="w-8 h-0.5 bg-[rgb(233,79,55)] mt-2.5 mb-1.5" />
          <p className="text-[0.8rem] text-white/40 font-light">
            Personalize your experience · Change anytime in Settings
          </p>
        </div>

        {/* 3-column card */}
        <div
          className="rounded-2xl border border-white/[0.07] border-t-white/[0.12] overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(rgba(14,14,14,0.92), rgba(14,14,14,0.92))",
            backgroundSize: "20px 20px, 100% 100%",
          }}
        >
          <div className="grid grid-cols-3">
            {/* Col 1 — Age */}
            <div className="flex flex-col p-6 border-r border-white/[0.06]">
              <SectionLabel>Your Age</SectionLabel>
              <div className="mb-4">
                <div className="font-['Bebas_Neue'] text-[4rem] leading-none text-[rgb(233,79,55)] tracking-[0.04em]">
                  {age}
                </div>
                <div className="text-[0.63rem] text-white/25 tracking-[0.14em] uppercase mt-0.5">
                  years old
                </div>
              </div>
              <div className="mt-auto">
                <AgeSlider value={age} onChange={setAge} />
              </div>
            </div>

            {/* Col 2 — Genres */}
            <div className="flex flex-col p-6 border-r border-white/[0.06]">
              <div className="flex items-center justify-between mb-3">
                <SectionLabel>Preferred Genres</SectionLabel>
                {genres.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setGenres([])}
                    className="text-[0.68rem] text-blue-400 hover:text-blue-300 transition-colors cursor-pointer bg-transparent border-none p-0"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="ob-scroll flex flex-wrap gap-1.5 overflow-y-auto flex-1 pr-0.5">
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
            <div className="flex flex-col p-6">
              <div className="flex items-center justify-between mb-3">
                <SectionLabel>Preferred Languages</SectionLabel>
                {languages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setLanguages([])}
                    className="text-[0.68rem] text-blue-400 hover:text-blue-300 transition-colors cursor-pointer bg-transparent border-none p-0"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="ob-scroll flex flex-wrap gap-1.5 overflow-y-auto flex-1 pr-0.5">
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
          <div className="border-t border-white/[0.07] px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex gap-6 text-[0.72rem] text-white/30">
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
              {processingLabel ? "Processing…" : "Save & Enter Moodies"}
            </SubmitButton>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          MOBILE (< 768px) — 3-step vertical wizard
      ═══════════════════════════════════════════════ */}
      <div
        className="ob-fadein flex md:hidden flex-col min-h-dvh bg-[#0a0a0a] relative font-['DM_Sans']"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        {/* Top red accent line */}
        <div className="fixed top-0 left-0 right-0 h-0.5 bg-[rgb(233,79,55)] opacity-70 z-50" />

        {/* Top bar */}
        <div className="flex items-center justify-between px-5 pt-5 flex-shrink-0">
          <div className="flex items-center gap-2 font-['Bebas_Neue'] text-xl tracking-widest text-white">
            <div className="w-2 h-2 rounded-full bg-[rgb(233,79,55)]" />
            Moodies
          </div>
          <div className="flex gap-1.5">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={[
                  "h-[3px] rounded-full transition-all duration-300",
                  i < mobileStepIndex
                    ? "w-[26px] bg-[rgba(233,79,55,0.4)]"
                    : i === mobileStepIndex
                      ? "w-[38px] bg-[rgb(233,79,55)]"
                      : "w-[26px] bg-white/10",
                ].join(" ")}
              />
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 flex flex-col px-5 pt-8 pb-4 overflow-y-auto min-h-0">
          {/* Step 1 — Age */}
          {mobileStep === "age" && (
            <div className="ob-stepin flex flex-col flex-1">
              <p className="text-[0.58rem] font-bold tracking-[0.2em] uppercase text-[rgb(233,79,55)] mb-1.5">
                Step 1 of 3
              </p>
              <h2 className="font-['Bebas_Neue'] text-[2.2rem] leading-none text-white mb-1.5">
                How old
                <br />
                are you?
              </h2>
              <p className="text-[0.72rem] text-white/38 font-light mb-7">
                Helps us match content ratings to you.
              </p>
              <div className="text-center py-6">
                <div className="font-['Bebas_Neue'] text-[7rem] leading-none text-[rgb(233,79,55)] tracking-[0.04em]">
                  {age}
                </div>
                <div className="text-[0.65rem] text-white/25 tracking-[0.16em] uppercase mt-1">
                  years old
                </div>
              </div>
              <div className="mt-auto">
                <AgeSlider value={age} onChange={setAge} />
              </div>
            </div>
          )}

          {/* Step 2 — Genres */}
          {mobileStep === "genres" && (
            <div className="ob-stepin flex flex-col flex-1">
              <p className="text-[0.58rem] font-bold tracking-[0.2em] uppercase text-[rgb(233,79,55)] mb-1.5">
                Step 2 of 3
              </p>
              <h2 className="font-['Bebas_Neue'] text-[2.2rem] leading-none text-white mb-1.5">
                What do
                <br />
                you watch?
              </h2>
              <p className="text-[0.72rem] text-white/38 font-light mb-4">
                Pick as many genres as you like.
              </p>
              <div className="flex items-center gap-2 text-[0.7rem] text-white/30 mb-3">
                <strong className="text-[rgb(233,79,55)] font-bold">
                  {genres.length}
                </strong>{" "}
                selected
                {genres.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setGenres([])}
                    className="text-blue-400 hover:text-blue-300 transition-colors cursor-pointer bg-transparent border-none p-0 text-[0.68rem]"
                  >
                    · Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
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
            <div className="ob-stepin flex flex-col flex-1">
              <p className="text-[0.58rem] font-bold tracking-[0.2em] uppercase text-[rgb(233,79,55)] mb-1.5">
                Step 3 of 3
              </p>
              <h2 className="font-['Bebas_Neue'] text-[2.2rem] leading-none text-white mb-1.5">
                Preferred
                <br />
                languages?
              </h2>
              <p className="text-[0.72rem] text-white/38 font-light mb-4">
                We'll prioritize content in these languages.
              </p>
              <div className="flex items-center gap-2 text-[0.7rem] text-white/30 mb-3">
                <strong className="text-[rgb(233,79,55)] font-bold">
                  {languages.length}
                </strong>{" "}
                selected
                {languages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setLanguages([])}
                    className="text-blue-400 hover:text-blue-300 transition-colors cursor-pointer bg-transparent border-none p-0 text-[0.68rem]"
                  >
                    · Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
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
        <div className="px-5 pb-8 pt-3 flex-shrink-0">
          <div className="flex gap-2.5">
            {mobileStepIndex > 0 && (
              <button
                type="button"
                onClick={() => setMobileStep(STEPS[mobileStepIndex - 1])}
                className="px-4 py-3 rounded-lg border border-white/10 bg-transparent text-white/40 text-sm font-medium hover:border-white/22 hover:text-white/70 transition-all cursor-pointer"
              >
                ← Back
              </button>
            )}
            {mobileStep !== "languages" ? (
              <button
                type="button"
                disabled={!canAdvanceMobile}
                onClick={() => setMobileStep(STEPS[mobileStepIndex + 1])}
                className={[
                  "flex-1 py-3 rounded-lg font-['Bebas_Neue'] text-[0.95rem] tracking-widest transition-all",
                  canAdvanceMobile
                    ? "bg-[rgb(233,79,55)] text-white shadow-[0_4px_16px_rgba(233,79,55,0.28)] hover:bg-[rgb(215,65,42)] active:scale-[0.98] cursor-pointer"
                    : "bg-white/[0.07] text-white/20 cursor-not-allowed",
                ].join(" ")}
              >
                Continue →
              </button>
            ) : (
              <button
                type="button"
                disabled={!canSubmit || isSubmitting || authLoading}
                onClick={handleSubmit}
                className={[
                  "flex-1 py-3 rounded-lg font-['Bebas_Neue'] text-[0.95rem] tracking-widest transition-all",
                  canSubmit && !isSubmitting && !authLoading
                    ? "bg-[rgb(233,79,55)] text-white shadow-[0_4px_16px_rgba(233,79,55,0.28)] hover:bg-[rgb(215,65,42)] active:scale-[0.98] cursor-pointer"
                    : "bg-white/[0.07] text-white/20 cursor-not-allowed",
                ].join(" ")}
              >
                {processingLabel ? "Processing…" : "Finish Setup"}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
