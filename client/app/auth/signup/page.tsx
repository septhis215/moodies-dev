"use client";

import { useState } from "react";
import Image from "next/image";
import Background from "../background";
import Link from "next/link";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:4000";

export default function SignupPage() {
  // form state
  const [id, setId] = useState("");                        // optional – only if your API requires it
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatarURL, setAvatarURL] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [preferredGenres, setPreferredGenres] = useState("");       // comma-separated
  const [preferredLanguages, setPreferredLanguages] = useState(""); // comma-separated
  const [agree, setAgree] = useState(false);

  // ui state
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  const toArray = (s: string) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");

    if (!agree) {
      setErr("Please agree to the Terms & Conditions.");
      return;
    }
    if (!email || !password || !username) {
      setErr("Username, email, and password are required.");
      return;
    }

    const payload: any = {
      username,
      email,
      password,
      avatarURL: avatarURL || undefined,
      age: typeof age === "number" ? age : undefined,
      preferredGenres: toArray(preferredGenres),
      preferredLanguages: toArray(preferredLanguages),
      createdAt: new Date().toISOString(),
    };


    if (id.trim()) payload.id = id.trim();

    try {
      setLoading(true);

      const res = await fetch(`${API_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        // try common error shapes: { message }, { error }, etc.
        throw new Error(data?.message || data?.error || "Sign up failed");
      }

      // If your API returns a token, store it (auto-login). Otherwise just redirect to login.
      if (data?.token) {
        localStorage.setItem("token", data.token);
        window.location.href = "/dashboard";
      } else {
        alert("Account created! Please log in.");
        window.location.href = "/auth/login";
      }
    } catch (e: any) {
      setErr(e.message || "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      {/* Background */}
      <Background />

      {/* Card */}
      <div className="bg-black/70 backdrop-blur-md p-8 rounded-2xl shadow-xl w-full max-w-4xl flex flex-col md:flex-row items-center gap-6">
        {/* Left side: Poster */}
        <div className="w-full md:w-1/2">
          <Image
            src="/images/ironmanposter.jpeg"
            alt="Iron Man Poster"
            width={500}
            height={700}
            className="rounded-xl shadow-lg"
          />
        </div>

        {/* Right side: Form */}
        <div className="w-full md:w-1/2 text-white">
          <h2 className="text-2xl font-bold mb-2">Create an account</h2>
          <p className="mb-6 text-sm">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-orange-400 hover:underline">
              Log In
            </Link>
          </p>

          <form onSubmit={handleSubmit}>
            {/* Username */}
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 mb-4 rounded-lg bg-transparent border border-gray-600 focus:border-blue-400 outline-none"
              required
            />

            {/* Email */}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 mb-4 rounded-lg bg-transparent border border-gray-600 focus:border-blue-400 outline-none"
              required
            />

            {/* Password */}
            <input
              type="password"
              placeholder="Enter Your Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 mb-4 rounded-lg bg-transparent border border-gray-600 focus:border-blue-400 outline-none"
              required
            />

            {/* Terms */}
            <label className="flex items-center mb-4 text-sm text-gray-300 select-none">
              <input
                type="checkbox"
                className="mr-2"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
              />
              I agree to the{" "}
              <Link href="/terms" className="ml-1 text-orange-400 hover:underline">
                Terms &amp; Conditions
              </Link>
            </label>

            {/* Error */}
            {err && <p className="text-red-400 text-sm mb-3">{err}</p>}

            {/* Create button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black hover:bg-gray-700 py-3 rounded-lg font-semibold disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-6">
            <hr className="flex-1 border-gray-600" />
            <span className="px-3 text-sm text-gray-400">Or register with</span>
            <hr className="flex-1 border-gray-600" />
          </div>

          {/* Social buttons (stub) */}
          <div className="flex gap-4">
            <button className="flex-1 flex items-center justify-center gap-2 bg-black text-white py-3 rounded-lg hover:bg-gray-700">
              <Image src="/images/google.png" alt="Google" width={20} height={20} />
              Google
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 bg-black text-white py-3 rounded-lg hover:bg-gray-700">
              <Image src="/images/facebook.png" alt="Facebook" width={20} height={20} />
              Facebook
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
