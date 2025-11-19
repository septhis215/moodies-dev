"use client";

import { useState } from "react";
import Link from "next/link";

const API =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:4000";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Login failed");

      const token: string | undefined = data?.access_token || data?.token;
      if (!token) throw new Error("No token returned from server");
      localStorage.setItem("authToken", data.token);
      
      // Day * hr * min * sec * ms
      const expiryMs = Date.now() + 1 * 24 * 60 * 60 * 1000;
      localStorage.setItem("authTokenExpiry", String(expiryMs));
      localStorage.setItem("user", JSON.stringify(data.user || {}));

      if (data?.user) {
        localStorage.setItem("authUser", JSON.stringify(data.user));
      }

      window.location.href = "/";
    } catch (e: any) {
      setErr(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = () => {
    // Preserve return path
    const from = typeof window !== "undefined" ? window.location.pathname : "/";
    window.location.href = `${API}/auth/google?from=${encodeURIComponent(from)}`;
  };

  return (
    <>
      <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
        Welcome back
      </h2>

      <p className="mt-2 text-sm text-white/70">
        New here?{" "}
        <Link href="/auth/signup" className="text-amber-400 hover:underline">
          Create an account
        </Link>
      </p>
      <br/>

      {/* Email / password */}
      <form onSubmit={onSubmit} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-xl bg-white/5 text-white placeholder:text-white/40
                     border border-white/10 focus:outline-none focus:ring-2 focus:ring-amber-400/60
                     focus:border-transparent transition"
        />

        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Enter Your Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 pr-12 rounded-xl bg-white/5 text-white placeholder:text-white/40
                       border border-white/10 focus:outline-none focus:ring-2 focus:ring-amber-400/60
                       focus:border-transparent transition"
          />

          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            title={showPassword ? "Hide password" : "Show password"}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded-md
                       hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
          >
            {showPassword ? (
              // Eye-off icon (password visible -> show "hide" icon)
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10 0-1.04.144-2.046.414-3.0M3 3l18 18M9.88 9.88A3 3 0 0012 15a3 3 0 003-3c0-.482-.122-.935-.335-1.326" />
              </svg>
            ) : (
              // Eye icon (password hidden -> show "view" icon)
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7c-1.274 4.057-5.065 7-9.542 7s-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>

        <div className="text-right">
          <Link
            href="/auth/forgot-password"
            className="text-sm text-white/60 hover:text-white"
          >
            Forgot Password?
          </Link>
        </div>

        {err && <p className="text-red-400 text-sm">{err}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl font-bold
                     bg-gradient-to-r from-amber-500 to-pink-500
                     hover:from-amber-400 hover:to-pink-400
                     shadow-[0_8px_30px_rgba(250,204,21,0.35)]
                     transition disabled:opacity-60"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

      </form>
    </>
  );
}
