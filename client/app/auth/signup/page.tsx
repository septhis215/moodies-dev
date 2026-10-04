"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LockKeyhole, Mail, User } from "lucide-react";
import {
  AuthBrand,
  AuthButton,
  AuthDivider,
  AuthFrame,
  AuthHeader,
  AuthInput,
  AuthLink,
  AuthMessage,
  AuthPasswordInput,
  GoogleIconButton,
} from "../AuthFormUI";
import { useTurnstileGate } from "@/hooks/useTurnstileGate";

const API =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "https://dev.api.moodies.tech/api";

export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { isVerified } = useTurnstileGate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const normalizedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();
    if (!agree) {
      setErr("Please agree to the Terms & Conditions.");
      return;
    }
    if (!isVerified) {
      setErr("Please complete the human verification.");
      return;
    }
    if (!/^[A-Za-z0-9_]{3,20}$/.test(normalizedUsername)) {
      setErr("Username must be 3–20 characters using only letters, numbers, or underscores.");
      return;
    }
    if (password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: normalizedUsername, email: normalizedEmail, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = Array.isArray(data.message) ? data.message[0] : data.message;
        throw new Error(message || "Sign up failed. Please try again.");
      }
      router.push("/auth/onboarding");
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Sign up failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    window.location.href = `${API}/auth/google`;
  };

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');`}</style>

      <AuthFrame className="py-1 sm:py-2">
        <AuthBrand compact />
        <AuthHeader title="Create an account" compact>
          Already have an account?{" "}
          <AuthLink href="/auth/login">Log in</AuthLink>
        </AuthHeader>

        <form
          onSubmit={onSubmit}
          className="space-y-2.5 [&_.auth-field]:space-y-1 [&_.auth-field-label]:text-[0.76rem] [&_button[type='submit']]:!h-10 [&_input:not([type='checkbox'])]:!h-10"
        >
          <AuthInput
            label="Username"
            type="text"
            placeholder="Choose a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            icon={<User className="h-4 w-4" aria-hidden />}
            required
          />

          <AuthInput
            label="Email Address"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            icon={<Mail className="h-4 w-4" aria-hidden />}
            required
          />

          <AuthPasswordInput
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            icon={<LockKeyhole className="h-4 w-4" aria-hidden />}
            shown={showPassword}
            onToggle={() => setShowPassword((s) => !s)}
            required
          />

          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-1.5 text-[0.72rem] leading-4 text-white/62 transition hover:border-white/18 hover:bg-white/[0.06]">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="h-3 w-3 cursor-pointer accent-[rgb(233,79,55)]"
            />
            <span>
              I agree to the{" "}
              <Link
                href="/terms"
                className="font-medium text-amber-300 underline-offset-4 hover:text-amber-200 hover:underline"
              >
                Terms &amp; Conditions
              </Link>
            </span>
          </label>

          {err && <AuthMessage>{err}</AuthMessage>}


          <AuthButton loading={loading} loadingText="Creating...">
            Create
          </AuthButton>
        </form>

        <AuthDivider compact>Or register with</AuthDivider>

        <GoogleIconButton
          loading={googleLoading}
          onClick={handleGoogleSignup}
        />
      </AuthFrame>
    </>
  );
}
