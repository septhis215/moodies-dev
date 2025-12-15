"use client";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function PasswordCreate() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get("token") || "";
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`${API}/auth/set-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.message || "Failed to set password");

    localStorage.setItem("authToken", data.token);

    if (data.user?.email) {
      localStorage.setItem("signupEmail", data.user.email);
      localStorage.setItem("signupPassword", password);
    }

    router.push("/auth/onboarding");
  }

  return (
    <main className="auth-page">
      <h1 className="text-xl font-semibold">Create your password</h1>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Enter a new password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            className="w-full px-4 py-3 pr-12 rounded-xl bg-white/5 text-white placeholder:text-white/50 border border-white/10 focus:outline-none focus:ring-2 focus:ring-amber-400/70 focus:border-transparent transition"
            required
          />

          {/* Toggle Button */}
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              // Eye-off icon
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
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
              // Eye icon
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
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
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button className="w-full rounded-xl px-5 py-3 font-semibold text-white transition-all bg-gradient-to-r from-amber-500 to-pink-500 hover:brightness-110">
          Continue
        </button>
      </form>
    </main>
  );
}
