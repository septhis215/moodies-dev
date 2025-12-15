import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/context/ToastContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const MOODIES_LOGO = "/images/moodies.png";
const MOODIES_SIZE = { width: 30, height: 30 };

export function useAuth() {
    const router = useRouter();
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

                // Perform sign-in
                const res = await fetch(`${API_BASE}/auth/signin`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password }),
                });

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data?.message || "Sign-in failed");
                }

                const token = data?.access_token || data?.token;
                if (!token) throw new Error("No token returned from server");

                // Store auth data
                localStorage.setItem("authToken", token);
                const expiryMs = Date.now() + 1 * 24 * 60 * 60 * 1000;
                localStorage.setItem("authTokenExpiry", String(expiryMs));
                localStorage.setItem("user", JSON.stringify(data.user || {}));

                if (data?.user) {
                    localStorage.setItem("authUser", JSON.stringify(data.user));
                }

                // Clean up temporary credentials
                localStorage.removeItem("signupEmail");
                localStorage.removeItem("signupPassword");

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
            } catch (error: any) {
                // Error toast with moodies logo
                toast(
                    error.message || "Failed to sign in",
                    "error",
                    4000,
                    "Sign-in Failed",
                    MOODIES_LOGO,
                    MOODIES_SIZE
                );

                return { success: false, error: error.message };
            } finally {
                setIsLoading(false);
            }
        },
        [toast, router]
    );

    return {
        signIn,
        isLoading,
    };
}