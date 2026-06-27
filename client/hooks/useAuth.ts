import { useState, useCallback } from "react";
import { useToast } from "@/app/context/ToastContext";
import { markSessionPresent } from "@/app/context/AuthProvider";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const MOODIES_LOGO = "/images/moodies-transparent.png";
const MOODIES_SIZE = { width: 30, height: 30 };

export function useAuth() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const signIn = useCallback(
        async (email: string, password: string) => {
            setIsLoading(true);

            // Show signing in toast with moodies logo
            toast(
                "Signing you in...",
                "info",
                5000,
                "Please wait",
                MOODIES_LOGO,
                MOODIES_SIZE
            );

            try {
                // 3-second delay
                await new Promise((resolve) => setTimeout(resolve, 3000));

                // Perform sign-in. The server sets the session as HttpOnly
                // cookies on this response — credentials:include is required for
                // the browser to store them, and there is no token to persist.
                const res = await fetch(`${API_BASE}/auth/signin`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ email, password }),
                });

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data?.message || "Sign-in failed");
                }

                markSessionPresent();

                // Success toast - use user avatar if available, otherwise moodies logo
                toast(
                    "Welcome back!",
                    "success",
                    3000,
                    data.user?.username || data.user?.email || "User",
                    data.user?.avatarUrl || MOODIES_LOGO,
                    data.user?.avatarUrl ? undefined : MOODIES_SIZE
                );

                // Small delay before redirect to let user see success
                await new Promise((resolve) => setTimeout(resolve, 500));

                // Redirect to home
                window.location.href = "/";

                return { success: true, data };
            } catch (error: unknown) {
                const message =
                    error instanceof Error ? error.message : "Failed to sign in";
                // Error toast with moodies logo
                toast(
                    message,
                    "error",
                    4000,
                    "Sign-in Failed",
                    MOODIES_LOGO,
                    MOODIES_SIZE
                );

                return { success: false, error: message };
            } finally {
                setIsLoading(false);
            }
        },
        [toast]
    );

    return {
        signIn,
        isLoading,
    };
}
