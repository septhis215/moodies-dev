"use client";

import { createContext, useContext } from "react";

export type TurnstileGateState = {
  isChecking: boolean;
  isVerified: boolean;
  isBlocked: boolean;
  error: string | null;
  verifyToken: (token: string) => Promise<void>;
};

export const TurnstileGateContext =
  createContext<TurnstileGateState | null>(null);

export function useTurnstileGate() {
  const value = useContext(TurnstileGateContext);
  if (!value) {
    throw new Error("useTurnstileGate must be used within TurnstileGateProvider");
  }
  return value;
}
