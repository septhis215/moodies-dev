"use client";

import { useState } from "react";
import { LockKeyhole, Mail } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
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
  AuthSupportNote,
  GoogleButton,
} from "../AuthFormUI";
import { useTurnstileGate } from "@/hooks/useTurnstileGate";

const API =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "https://dev.api.moodies.tech/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signIn, isLoading: authLoading } = useAuth();
  const { isVerified } = useTurnstileGate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authLoading) return;
    setErr("");
    if (!isVerified) {
      setErr("Please complete the human verification.");
      return;
    }

    const result = await signIn(email.trim().toLowerCase(), password);

    if (!result.success) {
      setErr(result.error || "Login failed");
    }
  };

  const handleGoogleLogin = () => {
    if (googleLoading) return;
    setGoogleLoading(true);

    const from = typeof window !== "undefined" ? window.location.pathname : "/";
    window.location.href = `${API}/auth/google?from=${encodeURIComponent(
      from,
    )}`;
  };

  return (
      <AuthFrame>
        <AuthBrand />
        <AuthHeader title="Welcome back">
          Log in to your watchlist and personalised picks.
        </AuthHeader>

        <form
          onSubmit={onSubmit}
          className="space-y-5"
        >
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
              labelSide={<span className="text-xs"><AuthLink href="/auth/forgot-password">Forgot password?</AuthLink></span>}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              icon={<LockKeyhole className="h-4 w-4" aria-hidden />}
              shown={showPassword}
              onToggle={() => setShowPassword((s) => !s)}
              required
            />

          {err && <AuthMessage>{err}</AuthMessage>}


          <AuthButton loading={authLoading} loadingText="Logging in…">
            Log in
          </AuthButton>
        </form>

        <AuthDivider>or</AuthDivider>

        <GoogleButton loading={googleLoading} onClick={handleGoogleLogin}>
          Continue with Google
        </GoogleButton>

        <p className="mt-6 text-center text-sm text-[var(--ink-muted)]">New to Moodies? <AuthLink href="/auth/signup">Create an account</AuthLink></p>
        <AuthSupportNote className="mt-6 border-t border-[var(--surface-border)] pt-5" />
      </AuthFrame>
  );
}
