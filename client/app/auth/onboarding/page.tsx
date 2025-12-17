"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/app/context/ToastContext";
import { useAuth } from "@/hooks/useAuth";

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
];

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
];

const Chip: React.FC<{
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      "px-4 py-2 rounded-lg text-sm transition-all font-medium border relative overflow-hidden group",
      active
        ? "bg-gradient-to-r from-amber-500 to-pink-500 text-white border-transparent shadow-lg shadow-amber-500/20"
        : "bg-white/5 text-white/70 hover:bg-white/10 border-white/10 hover:border-white/20",
    ].join(" ")}
  >
    {active && (
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
    )}
    <span className="relative">{children}</span>
  </button>
);

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { signIn, isLoading: authLoading } = useAuth();

  const [age, setAge] = useState<number>(18);
  const [genres, setGenres] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🔥 NEW: Handle token from URL (Google OAuth)
  useEffect(() => {
    const urlToken = searchParams.get("token");

    if (urlToken) {
      // Store the token from Google OAuth
      localStorage.setItem("authToken", urlToken);
      const expiryMs = Date.now() + 1 * 24 * 60 * 60 * 1000;
      localStorage.setItem("authTokenExpiry", String(expiryMs));

      // Clean up URL without the token
      window.history.replaceState({}, document.title, window.location.pathname);

      toast(
        "Connected with Google! Now set your preferences.",
        "success",
        3000,
        "Almost there",
        null
      );
    }
  }, [searchParams, toast]);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    list.includes(v) ? set(list.filter((x) => x !== v)) : set([...list, v]);

  const canSubmit = useMemo(
    () => age >= 1 && age <= 100 && genres.length > 0 && languages.length > 0,
    [age, genres.length, languages.length]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || authLoading) return;

    const token = localStorage.getItem("authToken");
    if (!token) {
      toast("Not logged in!", "error", 3000, "Authentication Error", null);
      return;
    }

    setIsSubmitting(true);

    try {
      // Save preferences
      toast(
        "Saving your preferences...",
        "info",
        3000,
        "Setting Up Your Profile",
        null
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

      // Success toast for preferences
      toast(
        "Preferences saved successfully!",
        "success",
        2000,
        "Profile Updated",
        null
      );

      // Small delay to let user see the success message
      await new Promise((resolve) => setTimeout(resolve, 800));

      // 🔥 UPDATED: Check if this is a Google OAuth user or regular signup
      const storedEmail = localStorage.getItem("signupEmail");
      const storedPassword = localStorage.getItem("signupPassword");

      if (storedEmail && storedPassword) {
        // Regular signup - auto sign in with stored credentials
        await signIn(storedEmail, storedPassword);
      } else {
        // Google OAuth user - already has token, just redirect to home
        toast(
          "Setup complete! Welcome to Moodies!",
          "success",
          2000,
          "You're all set",
          null
        );

        setTimeout(() => {
          window.location.href = "/";
        }, 500);
      }
    } catch (err: any) {
      toast(err.message || "An error occurred", "error", 4000, "Error", null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-6 py-4 overflow-y-hidden">
      <div className="space-y-6 max-h-[70vh] overflow-auto pr-1">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">
            <span className="bg-gradient-to-r from-amber-400 via-pink-500 to-purple-500 bg-clip-text text-transparent">
              Set up your preferences
            </span>
          </h1>
          <p className="mt-2 text-sm text-white/50">
            Personalize your experience • Change anytime in Settings
          </p>
        </div>

        {/* Age */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 to-pink-500/20 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative bg-white/5 rounded-xl p-5 border border-white/10 hover:border-white/20 transition-all backdrop-blur-sm">
            <label
              htmlFor="age"
              className="block text-sm font-semibold text-white mb-3"
            >
              Your Age
            </label>
            <div className="flex items-center justify-between mb-4">
              <span className="text-white/60 text-sm">
                Select your age range
              </span>
              <div className="px-4 py-1.5 bg-gradient-to-r from-amber-500/20 to-pink-500/20 rounded-lg border border-amber-500/30">
                <span className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-pink-400 bg-clip-text text-transparent">
                  {age}
                </span>
              </div>
            </div>
            <input
              id="age"
              type="range"
              min={1}
              max={100}
              step={1}
              value={age}
              onChange={(e) => setAge(Number(e.target.value))}
              className="range w-full"
            />
            <div className="mt-3 flex justify-between text-xs text-white/40">
              <span>1</span>
              <span>25</span>
              <span>50</span>
              <span>75</span>
              <span>100</span>
            </div>
          </div>
        </div>

        {/* Genres */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-pink-500/20 to-purple-500/20 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative bg-white/5 rounded-xl p-5 border border-white/10 hover:border-white/20 transition-all backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-white">
                Preferred Genres
              </label>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-white/5 rounded-full text-xs text-white/50 border border-white/10">
                  {genres.length} / {GENRE_OPTIONS.length}
                </span>
                {genres.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setGenres([])}
                    className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {GENRE_OPTIONS.map((g) => (
                  <Chip
                    key={g}
                    active={genres.includes(g)}
                    onClick={() => toggle(genres, setGenres, g)}
                  >
                    {g}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Languages */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative bg-white/5 rounded-xl p-5 border border-white/10 hover:border-white/20 transition-all backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-white">
                Preferred Languages
              </label>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-white/5 rounded-full text-xs text-white/50 border border-white/10">
                  {languages.length} / {LANGUAGE_OPTIONS.length}
                </span>
                {languages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setLanguages([])}
                    className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-40 overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {LANGUAGE_OPTIONS.map((l) => (
                  <Chip
                    key={l}
                    active={languages.includes(l)}
                    onClick={() => toggle(languages, setLanguages, l)}
                  >
                    {l}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting || authLoading}
          className={[
            "w-full rounded-xl px-5 py-3.5 font-semibold text-white transition-all relative overflow-hidden group",
            canSubmit && !isSubmitting && !authLoading
              ? "bg-gradient-to-r from-amber-500 via-pink-500 to-purple-500 hover:shadow-xl hover:shadow-pink-500/30"
              : "bg-white/5 text-white/30 cursor-not-allowed",
          ].join(" ")}
        >
          {canSubmit && !isSubmitting && !authLoading && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
          )}
          <span className="relative">
            {isSubmitting || authLoading ? "Processing..." : "Save Preferences"}
          </span>
        </button>
      </div>

      {/* slider styling */}
      <style jsx>{`
        .range {
          appearance: none;
          height: 8px;
          border-radius: 9999px;
          background: linear-gradient(
            to right,
            rgba(245, 158, 11, 0.3) 0%,
            rgba(236, 72, 153, 0.3) 100%
          );
          outline: none;
        }
        .range::-webkit-slider-thumb {
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 9999px;
          background: linear-gradient(to right, #f59e0b, #ec4899);
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(236, 72, 153, 0.4);
          transition: transform 0.2s;
        }
        .range::-webkit-slider-thumb:hover {
          transform: scale(1.1);
        }
        .range::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 9999px;
          background: linear-gradient(to right, #f59e0b, #ec4899);
          cursor: pointer;
          border: none;
          box-shadow: 0 4px 12px rgba(236, 72, 153, 0.4);
          transition: transform 0.2s;
        }
        .range::-moz-range-thumb:hover {
          transform: scale(1.1);
        }
      `}</style>
    </div>
  );
}
