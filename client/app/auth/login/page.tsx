"use client";

import { useState } from "react";
import Link from "next/link";
import { LockKeyhole, Mail } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { TurnstileCaptcha } from "@/components/ui/TurnstileCaptcha";
import {
  AuthBrand,
  AuthButton,
  AuthDivider,
  AuthFrame,
  AuthHeader,
  AuthInput,
  AuthLink,
  AuthMascotCallout,
  AuthMessage,
  AuthPasswordInput,
  AuthSupportNote,
  GoogleButton,
} from "../AuthFormUI";

const API =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:4000";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signIn, isLoading: authLoading } = useAuth();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!captchaToken) {
      setErr("Please complete the verification.");
      return;
    }

    const result = await signIn(email, password, captchaToken);

    if (!result.success) {
      setErr(result.error || "Login failed");
      setCaptchaToken("");
      setCaptchaResetKey((key) => key + 1);
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
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');`}</style>

      <AuthFrame>
        <AuthBrand />
        <AuthHeader
          title="Welcome back"
          titleSide={
            <TurnstileCaptcha
              action="login"
              onVerify={setCaptchaToken}
              onClear={() => setCaptchaToken("")}
              resetSignal={captchaResetKey}
              className="shrink-0"
              presentation="title"
            />
          }
        >
          New here? <AuthLink href="/auth/signup">Create an account</AuthLink>
        </AuthHeader>

        <AuthMascotCallout />

        <form
          onSubmit={onSubmit}
          className="space-y-5 [@media(max-height:700px)]:space-y-4"
        >
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

          <div className="space-y-2">
            <div className="ml-1 flex items-center justify-between gap-3">
              <label className="block text-sm font-semibold text-white/85">
                Password
              </label>
              <Link
                href="/auth/forgot-password"
                className="text-xs font-medium text-white/52 transition-colors hover:text-amber-200"
              >
                Forgot password?
              </Link>
            </div>
            <AuthPasswordInput
              label=""
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              icon={<LockKeyhole className="h-4 w-4" aria-hidden />}
              shown={showPassword}
              onToggle={() => setShowPassword((s) => !s)}
              required
            />
          </div>

          {err && <AuthMessage>{err}</AuthMessage>}

          <AuthButton loading={authLoading} loadingText="Logging in...">
            Login
          </AuthButton>
        </form>

        <AuthDivider>Or continue with</AuthDivider>

        <GoogleButton loading={googleLoading} onClick={handleGoogleLogin}>
          Continue with Google
        </GoogleButton>

        <AuthSupportNote className="mt-5 [@media(max-height:700px)]:mt-4" />
      </AuthFrame>
    </>
  );
}
