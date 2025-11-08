"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:4000";

export default function VerifyCodePage() {
  const router = useRouter();
  const email = useSearchParams().get("email") || "";
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    try {
      setLoading(true);
      const res = await fetch(`${API}/auth/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Invalid or expired code");

      // ✅ Verified → go to change password page
      router.push(`/auth/change-password?email=${encodeURIComponent(email)}`);
    } catch (e: any) {
      setMsg(e.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h2 className="text-2xl sm:text-3xl font-extrabold">Verify your email</h2>
      <p className="mt-2 text-sm text-white/70">
        We sent a 6-digit code to <span className="text-white">{email}</span>.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          placeholder="Enter 6-digit code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          required
          className="w-full px-4 py-3 rounded-xl bg-white/5 text-white placeholder:text-white/40
                     border border-white/10 focus:outline-none focus:ring-2 focus:ring-amber-400/60
                     focus:border-transparent transition"
        />
        {msg && <p className="text-amber-300 text-sm">{msg}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-amber-500 to-pink-500
                     hover:from-amber-400 hover:to-pink-400 transition disabled:opacity-60"
        >
          {loading ? "Verifying..." : "Verify"}
        </button>
      </form>
    </>
  );
}
