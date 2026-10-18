"use client";

export function AppErrorProvider({ children }: { children: React.ReactNode }) {
  // Session invalidation is owned by the refresh coordinator. A route-level 401
  // (for example an incorrect old password) must not end a valid session.
  return children;
}
