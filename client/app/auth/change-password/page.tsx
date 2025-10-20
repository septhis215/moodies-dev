"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const API =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:4000";

export default function ChangePasswordPage() {
  const router = useRouter();
  const email = useSearchParams().get("email") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");

    if (newPassword !== confirmPassword) {
      setMsg("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API}/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to reset password");

      setMsg("Password changed! Redirecting to login…");
      setTimeout(() => router.push("/auth/login"), 1500);
    } catch (e: any) {
      setMsg(e.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
        Change your password
      </h2>
      {email && (
        <p className="mt-2 text-sm text-white/60">for <span className="text-white">{email}</span></p>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <input
          type="password"
          placeholder="New Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-xl bg-white/5 text-white placeholder:text-white/40
                     border border-white/10 focus:outline-none focus:ring-2 focus:ring-amber-400/60
                     focus:border-transparent transition"
        />

        <input
          type="password"
          placeholder="Confirm New Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-xl bg-white/5 text-white placeholder:text-white/40
                     border border-white/10 focus:outline-none focus:ring-2 focus:ring-amber-400/60
                     focus:border-transparent transition"
        />

        {msg && <p className="text-amber-300 text-sm">{msg}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl font-bold
                     bg-gradient-to-r from-amber-500 to-pink-500
                     hover:from-amber-400 hover:to-pink-400
                     shadow-[0_8px_30px_rgba(250,204,21,0.35)]
                     transition disabled:opacity-60"
        >
          {loading ? "Changing..." : "Change Password"}
        </button>
      </form>
    </>
  );
}
