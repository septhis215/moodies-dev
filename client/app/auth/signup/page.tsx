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
  GoogleButton,
} from "../AuthFormUI";
import { useTurnstileGate } from "@/hooks/useTurnstileGate";
import { useAuth } from "@/app/context/AuthProvider";

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
  const { login } = useAuth();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
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
      await login(data.user);
      router.replace("/auth/intro");
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
      <AuthFrame>
        <AuthBrand compact />
        <AuthHeader title="Create an account" compact>
          Save your picks and find stories for your taste.
        </AuthHeader>

        <form
          onSubmit={onSubmit}
          className="space-y-5"
        >
          <AuthInput
            label="Username"
            type="text"
            placeholder="Choose a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            minLength={3}
            maxLength={20}
            pattern="[A-Za-z0-9_]{3,20}"
            hint="3–20 letters, numbers or underscores."
            icon={<User className="h-4 w-4" aria-hidden />}
            required
          />

          <AuthInput
            label="Email address"
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
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            hint="At least 8 characters."
            icon={<LockKeyhole className="h-4 w-4" aria-hidden />}
            shown={showPassword}
            onToggle={() => setShowPassword((s) => !s)}
            required
          />

          <div className="flex items-start gap-3 text-sm leading-6 text-[var(--ink-muted)]">
            <input
              id="signup-terms"
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              required
              className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[var(--brand-coral)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral-strong)]"
            />
            <div>
              <label htmlFor="signup-terms" className="cursor-pointer">I agree to the Terms &amp; Conditions.</label>{" "}
              <Link
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Terms and Conditions (opens in a new tab)"
                className="rounded-sm font-semibold text-[var(--brand-coral-strong)] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]"
              >
                Read terms
              </Link>
            </div>
          </div>

          {err && <AuthMessage>{err}</AuthMessage>}


          <AuthButton loading={loading} loadingText="Creating your account…">
            Create account
          </AuthButton>
        </form>

        <AuthDivider compact>or</AuthDivider>

        <GoogleButton
          loading={googleLoading}
          onClick={handleGoogleSignup}
        />
        <p className="mt-6 text-center text-sm text-[var(--ink-muted)]">
          Already have an account? <AuthLink href="/auth/login">Log in</AuthLink>
        </p>
      </AuthFrame>
  );
}
