"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Background from "../background";

export default function ChangePasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match!");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("http://localhost:3333/auth/forget-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, newPassword, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Failed to reset password");

      setSuccess("Password changed successfully!");
      setTimeout(() => router.push("/auth/login"), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Background />

      <div className="bg-black/70 backdrop-blur-md p-8 rounded-2xl shadow-xl w-full max-w-4xl flex flex-col md:flex-row items-center gap-6">
        <div className="w-full md:w-1/2">
          <Image
            src="/images/ironmanposter.jpeg"
            alt="Poster"
            width={500}
            height={700}
            className="rounded-xl shadow-lg"
          />
        </div>

        <div className="w-full md:w-1/2 text-white">
          <h2 className="text-2xl font-bold mb-6">Change Your Password</h2>

          <form onSubmit={handleChange}>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Type New Password"
              required
              className="w-full p-3 mb-4 rounded-lg bg-transparent border border-gray-600 focus:border-blue-400 outline-none"
            />

            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm New Password"
              required
              className="w-full p-3 mb-4 rounded-lg bg-transparent border border-gray-600 focus:border-blue-400 outline-none"
            />

            {error && <p className="text-red-400 mb-3 text-sm">{error}</p>}
            {success && <p className="text-green-400 mb-3 text-sm">{success}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black hover:bg-gray-700 py-3 rounded-lg font-semibold disabled:opacity-50"
            >
              {loading ? "Changing..." : "Change Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
