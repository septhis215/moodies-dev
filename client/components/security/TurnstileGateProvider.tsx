"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { TurnstileFullScreenGate } from "./TurnstileFullScreenGate";
import { TurnstileGateContext } from "@/hooks/useTurnstileGate";
import {
  captchaError,
  registerHumanChallenge,
  type HumanAction,
} from "@/lib/turnstile";

type Pending = {
  id: number;
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
  cleanup: () => void;
};

/** Public browsing never waits on a CAPTCHA/status request. Mutations request proof. */
export function TurnstileGateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [challenge, setChallenge] = useState<{
    id: number;
    action: HumanAction;
  } | null>(null);
  const pending = useRef<Pending | null>(null);
  const pathname = usePathname();
  const sequence = useRef(0);
  const finish = useCallback((id: number, token?: string) => {
    const current = pending.current;
    if (current?.id !== id) return;
    pending.current = null;
    current.cleanup();
    if (token) current.resolve(token);
    else
      current.reject(
        captchaError(
          "Security check cancelled. You can try this action again.",
        ),
      );
    setChallenge(null);
  }, []);
  useEffect(() => {
    const current = pending.current;
    if (current) finish(current.id);
  }, [pathname, finish]);
  useEffect(() => {
    const unregister = registerHumanChallenge(
      (nextAction, signal) =>
        new Promise((resolve, reject) => {
          if (signal.aborted) {
            reject(captchaError("Security check cancelled."));
            return;
          }
          const id = ++sequence.current;
          const abort = () => finish(id);
          signal.addEventListener("abort", abort, { once: true });
          pending.current = {
            id,
            resolve,
            reject,
            cleanup: () => signal.removeEventListener("abort", abort),
          };
          setChallenge({ id, action: nextAction });
        }),
    );
    return () => {
      unregister();
      const current = pending.current;
      pending.current = null;
      current?.cleanup();
      current?.reject(
        captchaError("Security check cancelled. Please try again."),
      );
    };
  }, [finish]);
  const value = useMemo(
    () => ({
      action: challenge?.action ?? null,
      complete: (token: string) => {
        if (challenge) finish(challenge.id, token);
      },
      cancel: () => {
        if (challenge) finish(challenge.id);
      },
    }),
    [challenge, finish],
  );
  return (
    <TurnstileGateContext.Provider value={value}>
      {children}
      {challenge && <TurnstileFullScreenGate key={challenge.id} />}
    </TurnstileGateContext.Provider>
  );
}
