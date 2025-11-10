"use client";
import { useEffect } from "react";

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
          alert("Session expired. Please log in again.");
          window.location.href = "/auth/login";
        }
      }
    };

    // Check every 5 seconds
    const interval = setInterval(checkExpiry, 5000);
    return () => clearInterval(interval);
  }, []);
}
