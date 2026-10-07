"use client";

import { useMemo, useState } from "react";
import { handleAppError } from "@/lib/errors";
import { appToast, TOAST_IDS } from "@/lib/toast";
import MoodiesIntro from "@/components/sections/MoodiesIntro";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api";

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

// ── Main component ────────────────────────────────────────────
export default function OnboardingPage() {
  const [age, setAge] = useState("");
  const numericAge = Number(age);
  const validAge = age !== "" && Number.isInteger(numericAge) && numericAge >= 1 && numericAge <= 100;
  const [genres, setGenres] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<Step>("age");

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    list.includes(v) ? set(list.filter((x) => x !== v)) : set([...list, v]);

  const canSubmit = useMemo(
    () => validAge && genres.length > 0 && languages.length > 0,
    [validAge, genres.length, languages.length],
  );

  const handleSubmit = async () => {
    if (isSubmitting || !canSubmit) return;
    setIsSubmitting(true);
    // Credentials are no longer staged in browser storage. Remove any value
    // left by an older client before continuing with the authenticated session.
    sessionStorage.removeItem("pendingSignup");
    const pendingSignup = null;
    try {
      if (pendingSignup) {
        const pending = JSON.parse(pendingSignup) as {
          username?: string;
          email?: string;
          password?: string;
          accountCreated?: boolean;
        };
        if (!pending.username || !pending.email || !pending.password) {
          throw new Error("Your signup details are incomplete. Please start again.");
        }
        appToast.loading("Creating your account...", {
          id: "onboarding-account-create",
          title: "Almost there!",
        });
        if (!pending.accountCreated) {
          const signupRes = await fetch(`${API_BASE}/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              username: pending.username,
              email: pending.email,
              password: pending.password,
            }),
          });
          const signupData = await signupRes.json();
          if (!signupRes.ok)
            throw new Error(signupData.message || "Sign up failed");
          sessionStorage.setItem(
            "pendingSignup",
            JSON.stringify({ ...pending, accountCreated: true }),
          );
        }
        // Authenticated via cookie now — save prefs with credentials.
        const prefsRes = await fetch(`${API_BASE}/auth/me/preferences`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            age: numericAge,
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
        window.location.href = "/";
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
            age: numericAge,
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

  const stepIndex = STEPS.indexOf(step);
  const canAdvance =
    step === "age"
      ? validAge
      : step === "genres"
        ? genres.length > 0
        : languages.length > 0;

  const titles = { age: "How old are you?", genres: "What do you love to watch?", languages: "Which languages do you prefer?" };
  const notes = { age: "Help us match content ratings to you.", genres: "Pick at least one. Browse all the options.", languages: "Choose at least one language for your picks." };
  return (
    <>
      <style>{`
        @media (max-width: 767px) { .ob-onboarding:has(input:focus) .ob-welcome { display: none; } }
        @media (max-height: 560px) { .ob-onboarding .ob-welcome { display: none; } }
      `}</style>
      <div className="ob-onboarding flex h-full min-h-0 flex-col bg-[var(--surface-0)] text-[var(--ink)]">
        <header className="flex shrink-0 items-center justify-between gap-4 px-4 pb-3 pt-4 sm:px-6 sm:pt-5">
          <span data-display className="text-xl font-bold">Moodies<span className="text-[var(--brand-coral-strong)]">.</span></span>
          <div role="group" aria-label={`Step ${stepIndex + 1} of 3`} className="flex gap-1.5">
            {STEPS.map((s, i) => <span key={s} aria-hidden="true" className={`h-1 w-6 rounded-full ${i <= stepIndex ? "bg-[var(--brand-coral)]" : "bg-[var(--surface-border)]"}`} />)}
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-2 sm:px-6">
          {step === "age" && <div className="ob-welcome mb-3 shrink-0"><MoodiesIntro variant="onboarding" headingId="onboarding-intro-heading" /></div>}
          <div className="mb-3 shrink-0">
            <p className="ui-kicker">Step {stepIndex + 1} of 3</p>
            <h1 id="onboarding-step-heading" className="mt-2 text-3xl font-bold leading-none">{titles[step]}</h1>
            {step !== "age" && <p className="mt-2 text-sm leading-5 text-[var(--ink-muted)]">{notes[step]}</p>}
          </div>
          {step === "age" ? <AgeInput value={age} onChange={setAge} id="onboarding-age" /> : (
            <PreferencePicker key={step} options={step === "genres" ? GENRE_OPTIONS : LANGUAGE_OPTIONS}
              selected={step === "genres" ? genres : languages} kind={step === "genres" ? "genre" : "language"}
              onToggle={(v) => step === "genres" ? toggle(genres, setGenres, v) : toggle(languages, setLanguages, v)}
              onClear={() => step === "genres" ? setGenres([]) : setLanguages([])} />
          )}
        </div>
        <footer className="shrink-0 border-t border-[var(--surface-border)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
          <div className="flex gap-3">
            {stepIndex > 0 && <button type="button" disabled={isSubmitting} onClick={() => setStep(STEPS[stepIndex - 1])} className="ui-secondary-action min-h-11">Back</button>}
            <button type="button" disabled={!(step === "languages" ? canSubmit : canAdvance) || isSubmitting}
              onClick={() => step === "languages" ? void handleSubmit() : setStep(STEPS[stepIndex + 1])}
              className="ui-primary-action min-h-11 flex-1 disabled:cursor-not-allowed disabled:opacity-40">
              {isSubmitting ? "Saving…" : step === "languages" ? "Finish Setup" : "Continue"}
            </button>
          </div>
        </footer>
      </div>
    </>
  );
}

function AgeInput({ value, onChange, id }: { value: string; onChange: (value: string) => void; id: string }) {
  const invalid = value !== "" && (Number(value) < 1 || Number(value) > 100);
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-[var(--ink)]">Your age</label>
      <div className="relative">
        <input id={id} type="text" inputMode="numeric" pattern="[0-9]*" maxLength={3} placeholder="-" value={value}
          onChange={(e) => { if (/^\d{0,3}$/.test(e.target.value)) onChange(e.target.value); }}
          aria-invalid={invalid} aria-describedby={`${id}-hint`}
          className="h-16 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-0)] px-4 pr-20 text-3xl font-semibold tabular-nums text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral-strong)]" />
        <span aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[var(--ink-muted)]">years</span>
      </div>
      <p id={`${id}-hint`} className={`mt-2 text-xs leading-5 ${invalid ? "text-[var(--brand-coral-strong)]" : "text-[var(--ink-muted)]"}`}>{invalid ? "Enter an age from 1 to 100." : "Enter your age, from 1 to 100."}</p>
    </div>
  );
}

function PreferencePicker({ options, selected, onToggle, onClear, kind }: {
  options: readonly string[]; selected: string[]; onToggle: (v: string) => void; onClear: () => void; kind: "genre" | "language";
}) {
  const [page, setPage] = useState(0);
  const shortViewport = useMediaQuery("(max-height: 520px)");
  const pageSize = shortViewport ? 3 : 9;
  const pageCount = Math.ceil(options.length / pageSize);
  const currentPage = Math.min(page, pageCount - 1);
  const visible = options.slice(currentPage * pageSize, currentPage * pageSize + pageSize);
  return (
    <div className="min-w-0">
      <div className="mb-2 flex min-h-8 items-center justify-between text-xs text-[var(--ink-muted)]">
        <p aria-live="polite">{selected.length} selected</p>
        <button type="button" onClick={onClear} disabled={!selected.length} className="min-h-8 px-2 font-semibold text-[var(--brand-coral-strong)] disabled:opacity-40">Clear</button>
      </div>
      <div role="group" aria-label={`Preferred ${kind}s`} className="grid auto-rows-fr grid-cols-3 gap-2">
        {visible.map((option) => <button key={option} type="button" aria-pressed={selected.includes(option)} onClick={() => onToggle(option)}
          className={`min-h-11 rounded-md border px-2 py-2 text-xs font-semibold leading-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral-strong)] motion-reduce:transition-none ${selected.includes(option) ? "border-[var(--brand-coral)] bg-[var(--brand-coral)]/15 text-[var(--ink)]" : "border-[var(--surface-border)] bg-[var(--surface-1)] text-[var(--ink-muted)] hover:border-[var(--ink-muted)] hover:text-[var(--ink)]"}`}>{option}</button>)}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <button type="button" aria-label={`Previous ${kind} options`} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="min-h-11 text-sm font-semibold text-[var(--ink)] disabled:opacity-30">Previous</button>
        <span className="text-xs text-[var(--ink-muted)]" aria-live="polite">{currentPage + 1} / {pageCount}</span>
        <button type="button" aria-label={`More ${kind} options`} disabled={currentPage === pageCount - 1} onClick={() => setPage(currentPage + 1)} className="min-h-11 text-sm font-semibold text-[var(--ink)] disabled:opacity-30">More options</button>
      </div>
    </div>
  );
}
