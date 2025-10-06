"use client";

import Image from "next/image";
import { useState } from "react";
import Background from "../background";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("http://localhost:3333/auth/forget-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Email not found");

      setSuccess("Password reset link sent successfully!");
      // Or redirect immediately if your backend doesn't send emails
      router.push(`/change-password?email=${encodeURIComponent(email)}`);
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
          <h2 className="text-2xl font-bold mb-4">Forgot Your Password?</h2>
          <p className="mb-6 text-sm text-gray-300">
            Enter the email address you used to register with{" "}
            <span className="text-blue-400">moodies</span>.
          </p>

          <form onSubmit={handleSubmit}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
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
              {loading ? "Processing..." : "Submit"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
