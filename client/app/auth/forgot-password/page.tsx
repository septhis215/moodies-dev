"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { normalizeApiError, normalizeResponseError } from "@/lib/errors";
import { appToast, TOAST_IDS } from "@/lib/toast";
import {
  AuthBrand,
  AuthButton,
  AuthFrame,
  AuthHeader,
  AuthInput,
  AuthLink,
  AuthMessage,
  AuthSupportNote,
} from "../AuthFormUI";

const API =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "https://dev.api.moodies.tech/api";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setMsg("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/request-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw await normalizeResponseError(
          new Response(JSON.stringify(data), {
            status: res.status,
            statusText: res.statusText,
          }),
          "Unable to send a recovery code right now.",
        );
      }

      appToast.success("If an account exists, a reset code has been sent.", {
        id: "password-reset-code-sent",
        title: "Check your email",
      });
      router.push(`/auth/verify-code?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch (e: unknown) {
      const appError = normalizeApiError(
        e,
        "Could not send reset code. Please try again.",
      );
      setMsg(appError.userMessage);
      appToast.error(appError.userMessage, {
        id: TOAST_IDS.passwordResetError,
        title: "Reset password",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
      <AuthFrame>
        <AuthBrand />
        <AuthHeader title="Forgot your password?">
          Enter the email you use for Moodies. We&apos;ll send a code to help you reset your password.
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

          {msg && <AuthMessage>{msg}</AuthMessage>}

          <AuthButton loading={loading} loadingText="Sending code…">
            Send reset code
          </AuthButton>
        </form>

        <p className="mt-6 text-center text-sm"><AuthLink href="/auth/login">Back to log in</AuthLink></p>
        <AuthSupportNote className="mt-8 border-t border-[var(--surface-border)] pt-5" />
      </AuthFrame>
  );
}
