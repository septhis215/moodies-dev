import { useState, useCallback } from "react";
import { markSessionPresent } from "@/app/context/AuthProvider";
import { handleAppError, normalizeResponseError } from "@/lib/errors";
import { appToast } from "@/lib/toast";
import { authenticateSession } from "@/lib/auth/session";
import { communityAuthReturnHref } from "@/lib/community-navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api";

export function useAuth() {
    const [isLoading, setIsLoading] = useState(false);

    const signIn = useCallback(
        async (email: string, password: string, returnTo?: string) => {
            setIsLoading(true);

            const loadingToastId = appToast.loading("Signing you in...", {
                id: "auth-signin-loading",
                title: "Please wait",
            });

            try {
                // Perform sign-in. The server sets the session as HttpOnly
                // cookies on this response — credentials:include is required for
                // the browser to store them, and there is no token to persist.
                const res = await authenticateSession(`${API_BASE}/auth/signin`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ email, password }),
                });

                const data = await res.json();

                if (!res.ok) {
                    throw await normalizeResponseError(
                        new Response(JSON.stringify(data), {
                            status: res.status,
                            statusText: res.statusText,
                        }),
                        "Sign-in failed. Please check your email and password."
                    );
                }

                markSessionPresent();

                appToast.success("Welcome back!", {
                    id: loadingToastId,
                    duration: 3000,
                    title: data.user?.username || data.user?.email || "User",
                });

                window.location.href = communityAuthReturnHref(returnTo);

                return { success: true, data };
            } catch (error: unknown) {
                const appError = handleAppError(error, {
                    fallbackMessage: "Sign-in failed. Please check your email and password.",
                    showToast: false,
                });
                appToast.error(appError.userMessage, {
                    id: loadingToastId,
                    duration: 5000,
                    title: "Sign-in Failed",
                });

                return { success: false, error: appError.userMessage };
            } finally {
                setIsLoading(false);
            }
        },
        []
    );

    return {
        signIn,
        isLoading,
    };
}
