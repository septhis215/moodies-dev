"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { sSet } from "@/utils/secureStorage";
import { AuthBrand, AuthFrame, AuthHeader, AuthMessage } from "../AuthFormUI";

export default function GoogleSuccessPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");

    if (!token) {
      setStatus("error");
      setTimeout(() => {
        window.location.href = "/auth/login";
      }, 2000);
      return;
    }

    sSet("authToken", token);
    const expiryMs = Date.now() + 1 * 24 * 60 * 60 * 1000;
    sSet("authTokenExpiry", String(expiryMs));

    const fetchUser = async () => {
      try {
        const API_BASE =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const userData = await res.json();
          sSet("authUser", JSON.stringify(userData));
          sSet("user", JSON.stringify(userData));
        }

        setStatus("success");
      } catch (error) {
        console.error("Error fetching user:", error);
        setStatus("success");
      }

      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
    };

    fetchUser();
  }, []);

  const statusContent = {
    loading: {
      title: "Signing you in",
      message: "Please wait while Moodies finishes your Google sign-in.",
      icon: (
        <Loader2 className="h-8 w-8 animate-spin text-amber-200" aria-hidden />
      ),
      tone: "info" as const,
    },
    success: {
      title: "Welcome to Moodies",
      message: "Google sign-in worked. Redirecting you now...",
      icon: <CheckCircle2 className="h-8 w-8 text-emerald-200" aria-hidden />,
      tone: "success" as const,
    },
    error: {
      title: "Sign-in failed",
      message: "We could not verify this Google session. Returning to login...",
      icon: <XCircle className="h-8 w-8 text-red-200" aria-hidden />,
      tone: "error" as const,
    },
  }[status];

  return (
    <>
      {" "}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');`}</style>
      <AuthFrame>
        <AuthBrand />
        <AuthHeader title={statusContent.title}>
          Your movie night is almost ready.
        </AuthHeader>

        <div className="rounded-2xl border border-white/12 bg-white/[0.05] p-5">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.06]">
            {statusContent.icon}
          </div>
          <AuthMessage tone={statusContent.tone}>
            {statusContent.message}
          </AuthMessage>
        </div>
      </AuthFrame>
    </>
  );
}
