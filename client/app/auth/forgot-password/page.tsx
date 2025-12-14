"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:4000";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/request-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Unable to send code");

      router.push(`/auth/verify-code?email=${encodeURIComponent(email)}`);
    } catch (e: any) {
      setMsg(e.message || "Unable to process request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-6 py-4">
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
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
            />
          </svg>
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-amber-400 to-pink-400 bg-clip-text text-transparent">
          Forgot your password?
        </h2>

        <p className="mt-2 text-sm text-white/60">
          Enter the email you used to register and we'll help you reset it.
        </p>
      </div>

      {/* Form Section */}
      <form onSubmit={onSubmit} className="space-y-3">
        {/* Email Input */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-white/80 ml-1">
            Email Address
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
                  d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                />
              </svg>
            </div>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-10 pr-3 py-2.5 rounded-none sm:rounded-lg bg-white/5 text-white text-sm placeholder:text-white/40
                         border border-white/10 focus:outline-none focus:ring-2 focus:ring-amber-400/60
                         focus:border-amber-400/50 focus:bg-white/10 transition-all"
            />
          </div>
        </div>

        {/* Message */}
        {msg && (
          <div className="p-2.5 rounded-none sm:rounded-lg bg-amber-500/10 border border-amber-500/30">
            <p className="text-amber-300 text-xs flex items-center gap-2">
              <svg
                className="w-4 h-4 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              {msg}
            </p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-none sm:rounded-lg font-bold text-sm text-white
                     bg-gradient-to-r from-amber-500 via-amber-400 to-pink-500
                     hover:from-amber-400 hover:via-amber-300 hover:to-pink-400
                     shadow-[0_8px_30px_rgba(250,204,21,0.35)]
                     hover:shadow-[0_12px_40px_rgba(250,204,21,0.45)]
                     transform hover:scale-[1.02] active:scale-[0.98]
                     transition-all duration-200 disabled:opacity-60 disabled:hover:scale-100 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Checking...
            </span>
          ) : (
            "Continue"
          )}
        </button>
      </form>
    </div>
  );
}
