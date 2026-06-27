"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { KeyRound } from "lucide-react";
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

export default function VerifyCodePage() {
  const router = useRouter();
  const email = useSearchParams().get("email") || "";
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    try {
      setLoading(true);
      const res = await fetch(`${API}/auth/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Invalid or expired code");
      }

      router.push(`/auth/change-password?email=${encodeURIComponent(email)}`);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {" "}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');`}</style>
      <AuthFrame>
        <AuthBrand />
        <AuthHeader title="Verify email">
          We sent a 6-digit code to{" "}
          <span className="font-medium text-white/85">
            {email || "your email"}
          </span>
          . <AuthLink href="/auth/forgot-password">Use another email</AuthLink>
        </AuthHeader>

        <form
          onSubmit={onSubmit}
          className="space-y-5 [@media(max-height:700px)]:space-y-4"
        >
          <AuthInput
            label="Verification Code"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="Enter 6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            icon={<KeyRound className="h-4 w-4" aria-hidden />}
            className="tracking-[0.35em]"
            required
          />

          {msg && <AuthMessage tone="info">{msg}</AuthMessage>}

          <AuthButton loading={loading} loadingText="Verifying...">
            Verify
          </AuthButton>
        </form>

        <AuthSupportNote className="mt-5 [@media(max-height:700px)]:mt-4" />
      </AuthFrame>
    </>
  );
}
