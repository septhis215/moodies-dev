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

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
      </form>
    </>
  );
}
