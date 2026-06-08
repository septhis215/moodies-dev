"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { sSet } from "@/utils/secureStorage";
import {
  AuthBrand,
  AuthButton,
  AuthFrame,
  AuthHeader,
  AuthMessage,
  AuthPasswordInput,
} from "../AuthFormUI";

export default function PasswordCreate() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get("token") || "";
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to set password");

      sSet("authToken", data.token);

      if (data.user?.email) {
        sSet("signupEmail", data.user.email);
        sSet("signupPassword", password);
      }

      router.push("/auth/onboarding");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to set password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');`}</style>

      <AuthFrame>
        <AuthBrand />
        <AuthHeader title="Create password">
          Set a secure password before continuing to onboarding.
        </AuthHeader>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 [@media(max-height:700px)]:space-y-4"
        >
          <AuthPasswordInput
            label="Password"
            placeholder="Enter a new password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            icon={<LockKeyhole className="h-4 w-4" aria-hidden />}
            shown={showPassword}
            onToggle={() => setShowPassword((s) => !s)}
            required
          />

          {error && <AuthMessage>{error}</AuthMessage>}

          <AuthButton loading={loading} loadingText="Saving...">
            Continue
          </AuthButton>
        </form>
      </AuthFrame>
    </>
  );
}
