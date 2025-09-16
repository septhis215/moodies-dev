"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Background from "../background";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/change-password");
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
            alt="Poster"
            width={500}
            height={700}
            className="rounded-xl shadow-lg"
          />
        </div>

        {/* Right side: Form */}
        <div className="w-full md:w-1/2 text-white">
          <h2 className="text-2xl font-bold mb-4">Forgot Your Password?</h2>
          <p className="mb-6 text-sm text-gray-300">
            Enter the email address you used to register with <span className="text-blue-400">moodies</span>
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

            <button
              type="submit"
              className="w-full bg-black hover:bg-gray-700 py-3 rounded-lg font-semibold"
            >
              Submit
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
