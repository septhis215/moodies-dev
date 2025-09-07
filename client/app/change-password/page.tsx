"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Background from "../background"; 

export default function ChangePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleChange = (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    alert("Password changed successfully!");
    router.push("/");
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
            src="/ironmanposter.jpeg"
            alt="Poster"
            width={500}
            height={700}
            className="rounded-xl shadow-lg"
          />
        </div>

        {/* Right side: Form */}
        <div className="w-full md:w-1/2 text-white">
          <h2 className="text-2xl font-bold mb-6">Change Your Password</h2>

          <form onSubmit={handleChange}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

            <button
              type="submit"
              className="w-full bg-black hover:bg-gray-700 py-3 rounded-lg font-semibold"
            >
              Change
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
