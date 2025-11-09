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
    router.push("/auth/onboarding");
  }

  return (
    <main className="auth-page">
      <h1 className="text-xl font-semibold">Create your password</h1>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <input
          type="password"
          placeholder="Enter a new password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 rounded border bg-transparent"
          required
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button className="btn-primary w-full py-3 rounded-lg">Continue</button>
      </form>
    </main>
  );
}
