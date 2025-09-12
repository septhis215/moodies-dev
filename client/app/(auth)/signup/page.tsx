"use client";

import Image from "next/image";
import Background from "../background";
import Link from "next/link";

export default function SignupPage() {
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
            <Link href="/" className="text-orange-400 hover:underline">
              Log In
            </Link>
          </p>

          {/* Name */}
            <input
              type="text"
              placeholder="Username"
              className="w-full p-3 mb-4 rounded-lg bg-transparent border border-gray-600 focus:border-blue-400 outline-none"
            />
          {/* Email */}
          <input
            type="email"
            placeholder="Email"
            className="w-full p-3 mb-4 rounded-lg bg-transparent border border-gray-600 focus:border-blue-400 outline-none"
          />

          {/* Password */}
          <input
            type="password"
            placeholder="Enter Your Password"
            className="w-full p-3 mb-4 rounded-lg bg-transparent border border-gray-600 focus:border-blue-400 outline-none"
          />

          {/* Terms */}
          <div className="flex items-center mb-6 text-sm text-gray-400">
            <input type="checkbox" id="terms" className="mr-2" />
            <label htmlFor="terms">
              I agree to the{" "}
              <Link href="/terms" className="text-orange-400 hover:underline">
                Terms & Conditions
              </Link>
            </label>
          </div>

          {/* Create button */}
          <button className="w-full bg-black hover:bg-gray-700 py-3 rounded-lg font-semibold">
            Create
          </button>

          {/* Divider */}
          <div className="flex items-center my-6">
            <hr className="flex-1 border-gray-600" />
            <span className="px-3 text-sm text-gray-400">Or register with</span>
            <hr className="flex-1 border-gray-600" />
          </div>

          {/* Social buttons */}
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
