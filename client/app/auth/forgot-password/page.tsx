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
  "http://localhost:4000";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/request-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
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
      router.push(`/auth/verify-code?email=${encodeURIComponent(email)}`);
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
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');`}</style>

      <AuthFrame>
        <AuthBrand />
        <AuthHeader title="Reset password">
          Enter your email and we&apos;ll send a recovery code.{" "}
          <AuthLink href="/auth/login">Back to login</AuthLink>
        </AuthHeader>

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

          {msg && <AuthMessage tone="info">{msg}</AuthMessage>}

          <AuthButton loading={loading} loadingText="Checking...">
            Continue
          </AuthButton>
        </form>

        <AuthSupportNote className="mt-5 [@media(max-height:700px)]:mt-4" />
      </AuthFrame>
    </>
  );
}
