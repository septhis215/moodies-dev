"use client";

import { useState } from "react";
import Image from "next/image";
import Background from "../background";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Login failed");

      // store token and redirect
      localStorage.setItem("token", data.token);
      alert("Login successful!");
      window.location.href = "/";
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
        {/* Left Poster */}
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
          <h2 className="text-2xl font-bold mb-2">Login</h2>
          <p className="mb-6 text-sm">
            Don’t have an account yet?{" "}
            <Link href="/auth/signup" className="text-orange-400 hover:underline">
              Sign up
            </Link>
          </p>

          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 mb-4 rounded-lg bg-transparent border border-gray-600 focus:border-blue-400 outline-none"
              required
            />

            <input
              type="password"
              placeholder="Enter Your Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 mb-2 rounded-lg bg-transparent border border-gray-600 focus:border-blue-400 outline-none"
              required
            />

            <div className="text-right mb-6">
              <Link href="/auth/forgot-password" className="text-sm text-gray-400 hover:underline">
                Forgot Password?
              </Link>
            </div>

            {error && <p className="text-red-400 mb-3 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black hover:bg-gray-700 py-3 rounded-lg font-semibold disabled:opacity-50"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
