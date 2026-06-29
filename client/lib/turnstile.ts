const API =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:4000";

export type TurnstileStatusResponse = {
  verified: boolean;
};

export type TurnstileVerifyResponse = {
  success: boolean;
  verified: boolean;
  message?: string;
};

export async function fetchTurnstileStatus(): Promise<TurnstileStatusResponse> {
  const response = await fetch(`${API}/security/turnstile/status`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Could not check verification status.");
  return response.json();
}

export async function verifyTurnstileToken(
  token: string,
): Promise<TurnstileVerifyResponse> {
  const response = await fetch(`${API}/security/turnstile/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ token }),
  });

  const payload = (await response.json().catch(() => ({}))) as Partial<
    TurnstileVerifyResponse
  >;

  if (!response.ok || !payload.success || !payload.verified) {
    return {
      success: false,
      verified: false,
      message:
        typeof payload.message === "string"
          ? payload.message
          : "Verification failed. Please try again.",
    };
  }

  return { success: true, verified: true };
}
