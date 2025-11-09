"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:4000";

export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!agree) { setErr("Please agree to the Terms & Conditions."); return; }

    try {
      setLoading(true);
      const res = await fetch(`${API}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Sign up failed");

      if (data?.token) {
        localStorage.setItem("authToken", data.token);
        router.push("/auth/onboarding");
      } else {
        router.push("/auth/login");
      }
    } catch (e: any) {
      setErr(e.message || "Sign up failed");
    } finally {
      setLoading(false);
    }
  };
  const handleGoogleSignup = () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    window.location.href = `${API}/auth/google`;
  };



  return (
    <>
      <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
        Create an account
      </h2>
      <p className="mt-2 text-sm text-white/70">
        Already have an account?{" "}
        <Link href="/auth/login" className="text-amber-400 hover:underline">
          Log In
        </Link>
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-xl bg-white/5 text-white placeholder:text-white/40
                     border border-white/10 focus:outline-none focus:ring-2 focus:ring-amber-400/60
                     focus:border-transparent transition"
        />

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

        <label className="flex items-center gap-2 text-sm text-white/80 select-none">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
          />
          I agree to the{" "}
          <Link href="/terms" className="text-amber-400 hover:underline">
            Terms &amp; Conditions
          </Link>
        </label>

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
          {loading ? "Creating..." : "Create"}
        </button>
      </form>

      <div className="flex items-center gap-3 my-6">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs text-white/50">Or register with</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

        <button
        type="button"
        onClick={handleGoogleSignup}
        disabled={googleLoading}
        aria-label="Continue with Google"
        className={[
          "w-full relative flex items-center justify-center gap-3",
          "rounded-xl px-4 py-3",
          "bg-zinc-900/70 text-white",          
          "border border-white/10",             
          "backdrop-blur",                      
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_6px_24px_rgba(0,0,0,0.35)]",
          "hover:bg-zinc-900/90 hover:border-white/20",
          "active:scale-[0.99]",
          "transition",
          "focus:outline-none focus:ring-2 focus:ring-amber-400/70 focus:ring-offset-2 focus:ring-offset-black",
          "disabled:opacity-60 disabled:cursor-not-allowed",
        ].join(" ")}
      >
        {/* Google 'G' icon */}
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.72 1.22 9.23 3.6l6.9-6.9C35.9 2.2 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l8.36 6.49C12.7 13.64 17.9 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.5 24c0-1.64-.15-3.2-.43-4.7H24v9h12.7c-.55 2.97-2.22 5.5-4.72 7.2l7.2 5.58C43.84 37.72 46.5 31.36 46.5 24z"/>
          <path fill="#FBBC04" d="M11 27.71A14.46 14.46 0 0 1 10.5 24c0-1.29.18-2.54.5-3.71L2.64 13.22A23.902 23.902 0 0 0 0 24c0 3.86.92 7.5 2.56 10.78l8.44-7.07z"/>
          <path fill="#34A853" d="M24 48c6.42 0 11.82-2.12 15.76-5.8l-7.2-5.58C30.37 38.5 27.42 39.5 24 39.5c-6.1 0-11.3-4.14-13.08-9.71l-8.36 6.99C6.51 42.62 14.62 48 24 48z"/>
        </svg>

        <span className="font-medium">
          {googleLoading ? "Redirecting…" : "Continue with Google"}
        </span>

        {/* subtle inner sheen */}
        <span
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" }}
        />
      </button>
    </>
  );
}
