"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

const API =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:4000";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signIn, isLoading: authLoading } = useAuth();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");

    const result = await signIn(email, password);

    if (!result.success) {
      setErr(result.error || "Login failed");
    }
    // Success case is handled by the hook (toasts + redirect)
  };

  const handleGoogleLogin = () => {
    if (googleLoading) return;
    setGoogleLoading(true);

    // Preserve return path
    const from = typeof window !== "undefined" ? window.location.pathname : "/";
    window.location.href = `${API}/auth/google?from=${encodeURIComponent(
      from
    )}`;
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
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-amber-400 to-pink-400 bg-clip-text text-transparent">
          Welcome back
        </h2>

        <p className="mt-2 text-sm text-white/60">
          New here?{" "}
          <Link
            href="/auth/signup"
            className="text-amber-400 hover:text-amber-300 font-semibold transition-colors underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
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

        {/* Password Input */}
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

        {/* Forgot Password Link */}
        <div className="flex justify-end">
          <Link
            href="/auth/forgot-password"
            className="text-xs text-white/50 hover:text-amber-400 transition-colors font-medium"
          >
            Forgot Password?
          </Link>
        </div>

        {/* Error Message */}
        {err && (
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
              {err}
            </p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={authLoading}
          className="w-full py-2.5 rounded-none sm:rounded-lg font-bold text-sm text-white
                     bg-gradient-to-r from-amber-500 via-amber-400 to-pink-500
                     hover:from-amber-400 hover:via-amber-300 hover:to-pink-400
                     shadow-[0_8px_30px_rgba(250,204,21,0.35)]
                     hover:shadow-[0_12px_40px_rgba(250,204,21,0.45)]
                     transform hover:scale-[1.02] active:scale-[0.98]
                     transition-all duration-200 disabled:opacity-60 disabled:hover:scale-100 disabled:cursor-not-allowed"
        >
          {authLoading ? (
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
              Logging in...
            </span>
          ) : (
            "Login"
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3 my-4">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs text-white/50">Or continue with</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      {/* Google Button */}
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={googleLoading}
        aria-label="Continue with Google"
        className="w-full relative flex items-center justify-center gap-2.5
                   rounded-none sm:rounded-lg px-3 py-2.5
                   bg-zinc-900/70 text-white text-sm
                   border border-white/10
                   backdrop-blur
                   shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_6px_24px_rgba(0,0,0,0.35)]
                   hover:bg-zinc-900/90 hover:border-white/20
                   active:scale-[0.99]
                   transition-all
                   focus:outline-none focus:ring-2 focus:ring-amber-400/70 focus:ring-offset-2 focus:ring-offset-black
                   disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {/* Google 'G' icon */}
        <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
          <path
            fill="#EA4335"
            d="M24 9.5c3.54 0 6.72 1.22 9.23 3.6l6.9-6.9C35.9 2.2 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l8.36 6.49C12.7 13.64 17.9 9.5 24 9.5z"
          />
          <path
            fill="#4285F4"
            d="M46.5 24c0-1.64-.15-3.2-.43-4.7H24v9h12.7c-.55 2.97-2.22 5.5-4.72 7.2l7.2 5.58C43.84 37.72 46.5 31.36 46.5 24z"
          />
          <path
            fill="#FBBC04"
            d="M11 27.71A14.46 14.46 0 0 1 10.5 24c0-1.29.18-2.54.5-3.71L2.64 13.22A23.902 23.902 0 0 0 0 24c0 3.86.92 7.5 2.56 10.78l8.44-7.07z"
          />
          <path
            fill="#34A853"
            d="M24 48c6.42 0 11.82-2.12 15.76-5.8l-7.2-5.58C30.37 38.5 27.42 39.5 24 39.5c-6.1 0-11.3-4.14-13.08-9.71l-8.36 6.99C6.51 42.62 14.62 48 24 48z"
          />
        </svg>

        <span className="font-medium">
          {googleLoading ? "Redirecting…" : "Continue with Google"}
        </span>

        {/* subtle inner sheen */}
        <span
          className="pointer-events-none absolute inset-0 rounded-none sm:rounded-lg"
          style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" }}
        />
      </button>
    </div>
  );
}
