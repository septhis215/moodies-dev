"use client";
import { useEffect } from "react";
import { appToast, TOAST_IDS } from "@/lib/toast";

export default function useAutoLogout() {
  useEffect(() => {
    const checkExpiry = () => {
      const expiry = localStorage.getItem("token_expiry");
      const token = localStorage.getItem("token");
      if (expiry && token) {
        const now = Date.now();
        if (now >= Number(expiry)) {
          // Clear and redirect
          localStorage.removeItem("token");
          localStorage.removeItem("token_expiry");
          appToast.error("Your session expired. Please log in again.", {
            id: TOAST_IDS.authSessionExpired,
            title: "Session expired",
            duration: 6000,
          });
          window.location.href = "/auth/login";
        }
      }
    };

    // Check every 5 seconds
    const interval = setInterval(checkExpiry, 5000);
    return () => clearInterval(interval);
  }, []);
}
