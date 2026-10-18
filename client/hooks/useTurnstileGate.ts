"use client";
import { createContext, useContext } from "react";
import type { HumanAction } from "@/lib/turnstile";

export type TurnstileGateState = {
  action: HumanAction | null;
  complete: (token: string) => void;
  cancel: () => void;
};
export const TurnstileGateContext = createContext<TurnstileGateState | null>(
  null,
);
export function useTurnstileGate() {
  const value = useContext(TurnstileGateContext);
  if (!value)
    throw new Error(
      "useTurnstileGate must be used within TurnstileGateProvider",
    );
  return value;
}
