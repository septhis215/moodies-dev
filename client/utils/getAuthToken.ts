import { sGet } from "@/utils/secureStorage";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    sGet("authToken") ||
    sGet("token") ||
    sGet("access_token") ||
    null
  );
}