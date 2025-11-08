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

      // store token & expiry (adjust to your policy)
      const expiryTime = Date.now() + 60 * 1000; // 1 min
      localStorage.setItem("token", data.token);
      localStorage.setItem("token_expiry", expiryTime.toString());
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

        <input
          type="password"
          placeholder="Enter Your Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-xl bg-white/5 text-white placeholder:text-white/40
                     border border-white/10 focus:outline-none focus:ring-2 focus:ring-amber-400/60
                     focus:border-transparent transition"
        />

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

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs uppercase tracking-widest text-white/50">
            or
          </span>
          <div className="h-px flex-1 bg-white/10" />
        </div>
      
        
      {/* Social login */}
      <div className="mt-6">
        <button
          type="button"
          onClick={onGoogle}
          className="group relative w-full inline-flex items-center justify-center gap-3
                     rounded-xl border border-white/10 bg-white/5 hover:bg-white/10
                     px-4 py-3 text-sm font-semibold text-white transition
                     ring-1 ring-inset ring-white/10 hover:ring-white/20
                     shadow-[0_8px_30px_rgba(255,255,255,0.07)]"
          aria-label="Continue with Google"
        >
          {/* Google icon */}
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            className="opacity-90 group-hover:opacity-100"
          >
            <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.2-1.7 3.6-5.5 3.6-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.3.8 4.1 1.6l2.8-2.7C16.9 2.5 14.7 1.6 12 1.6 6.9 1.6 2.8 5.7 2.8 10.8S6.9 20 12 20c6.9 0 9.2-4.8 9.2-7.3 0-.5 0-.9-.1-1.2H12z"/>
          </svg>
          <span>Google</span>
          <span className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r from-amber-400/0 via-amber-400/0 to-pink-500/0 group-hover:from-amber-400/10 group-hover:via-amber-400/0 group-hover:to-pink-500/10 transition" />
        </button>

      </div>
      </form>
    </>
  );
}
