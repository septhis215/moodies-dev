"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { LockKeyhole } from "lucide-react";
import {
  AuthBrand,
  AuthButton,
  AuthFrame,
  AuthHeader,
  AuthMessage,
  AuthPasswordInput,
} from "../AuthFormUI";

const API =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:4000";

export default function ChangePasswordPage() {
  const router = useRouter();
  const email = useSearchParams().get("email") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [success, setSuccess] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setMsg("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to reset password");
      }

      setSuccess(true);
      setMsg("Password changed. Redirecting to login...");
      setTimeout(() => router.push("/auth/login"), 1200);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Failed to reset password");
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
        <AuthHeader title="Change password">
          {email ? (
            <>
              Resetting access for{" "}
              <span className="font-medium text-white/85">{email}</span>
            </>
          ) : (
            "Create a new password to recover your account."
          )}
        </AuthHeader>

        <form
          onSubmit={onSubmit}
          className="space-y-5 [@media(max-height:700px)]:space-y-4"
        >
          <AuthPasswordInput
            label="New Password"
            placeholder="Enter a new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            icon={<LockKeyhole className="h-4 w-4" aria-hidden />}
            shown={showNewPassword}
            onToggle={() => setShowNewPassword((s) => !s)}
            required
          />

          <AuthPasswordInput
            label="Confirm Password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            icon={<LockKeyhole className="h-4 w-4" aria-hidden />}
            shown={showConfirmPassword}
            onToggle={() => setShowConfirmPassword((s) => !s)}
            required
          />

          {msg && (
            <AuthMessage tone={success ? "success" : "error"}>
              {msg}
            </AuthMessage>
          )}

          <AuthButton loading={loading} loadingText="Changing...">
            Change Password
          </AuthButton>
        </form>
      </AuthFrame>
    </>
  );
}
