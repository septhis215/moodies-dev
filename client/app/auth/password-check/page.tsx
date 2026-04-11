"use client";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { sSet } from "@/utils/secureStorage";

export default function PasswordCheck() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get("token") || "";
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`${API}/auth/verify-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.message || "Wrong password");

    sSet("authToken", data.token);
    router.push("/auth/onboarding");
  }

  return (
    <>
      {/* Header Section */}
      <div className="text-center mb-4">
        <div className="inline-block p-2 rounded-none sm:rounded-xl bg-gradient-to-br from-amber-500/20 to-pink-500/20 mb-2">
          <svg
            className="w-6 h-6 text-amber-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-amber-400 to-pink-400 bg-clip-text text-transparent">
          Enter your password
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Verify your identity to continue
        </p>
      </div>

      {/* Form Section */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-white/80 ml-1">
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="h-4 w-4 text-white/40"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full pl-10 pr-10 py-2.5 rounded-none sm:rounded-lg bg-white/5 text-white text-sm placeholder:text-white/40
                         border border-white/10 focus:outline-none focus:ring-2 focus:ring-amber-400/60
                         focus:border-amber-400/50 focus:bg-white/10 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 rounded-lg
                         hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-400/40 transition-colors"
            >
              {showPassword ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-white/60"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10 0-1.04.144-2.046.414-3.0M3 3l18 18M9.88 9.88A3 3 0 0012 15a3 3 0 003-3c0-.482-.122-.935-.335-1.326"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-white/60"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7c-1.274 4.057-5.065 7-9.542 7s-8.268-2.943-9.542-7z"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-2.5 rounded-none sm:rounded-lg bg-red-500/10 border border-red-500/30">
            <p className="text-red-400 text-xs flex items-center gap-2">
              <svg
                className="w-4 h-4 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              {error}
            </p>
          </div>
        )}

        <button
          type="submit"
          className="w-full py-2.5 rounded-none sm:rounded-lg font-bold text-sm text-white
                     bg-gradient-to-r from-amber-500 via-amber-400 to-pink-500
                     hover:from-amber-400 hover:via-amber-300 hover:to-pink-400
                     shadow-[0_8px_30px_rgba(250,204,21,0.35)]
                     hover:shadow-[0_12px_40px_rgba(250,204,21,0.45)]
                     transform hover:scale-[1.02] active:scale-[0.98]
                     transition-all duration-200 disabled:opacity-60 disabled:hover:scale-100 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </form>
    </>
  );
}
