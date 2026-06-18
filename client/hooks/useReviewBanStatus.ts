import { useState, useEffect } from "react";
import { useAuth } from "@/app/context/AuthProvider";
import { sGet } from "@/utils/secureStorage";

interface BanStatus {
  banned: boolean;
  bannedUntil: Date | null;
  timeRemaining: string;
}

const API =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:4000";

export function useReviewBanStatus() {
  const { isAuthenticated } = useAuth();
  const [banStatus, setBanStatus] = useState<BanStatus>({
    banned: false,
    bannedUntil: null,
    timeRemaining: "",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const checkBanStatus = async () => {
      try {
        const token = sGet("authToken");
        const response = await fetch(
          `${API}/reviews/me/ban-status`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setBanStatus({
            banned: data.banned,
            bannedUntil: data.bannedUntil ? new Date(data.bannedUntil) : null,
            timeRemaining: "",
          });
        }
      } catch (error) {
        console.error("Failed to check ban status:", error);
      } finally {
        setLoading(false);
      }
    };

    checkBanStatus();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!banStatus.banned || !banStatus.bannedUntil) return;

    const updateTimeRemaining = () => {
      const now = new Date();
      const diff = banStatus.bannedUntil!.getTime() - now.getTime();

      if (diff <= 0) {
        setBanStatus((prev) => ({ ...prev, banned: false, timeRemaining: "" }));
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      let timeStr = "";
      if (days > 0) timeStr += `${days}d `;
      if (hours > 0) timeStr += `${hours}h `;
      if (minutes > 0) timeStr += `${minutes}m `;
      timeStr += `${seconds}s`;

      setBanStatus((prev) => ({ ...prev, timeRemaining: timeStr.trim() }));
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [banStatus.banned, banStatus.bannedUntil]);

  return { banStatus, loading };
}
