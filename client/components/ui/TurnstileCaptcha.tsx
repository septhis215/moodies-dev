"use client";
import { useEffect, useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

type Props = {
  action: string;
  onVerify: (token: string) => void;
  onClear: () => void;
  resetSignal?: number;
  className?: string;
  presentation?: "default" | "compact" | "title";
};
const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SLOW_CHECK_MS = 15_000;
const SCRIPT_ID = "moodies-turnstile-script";

export function TurnstileCaptcha({
  action,
  onVerify,
  onClear,
  resetSignal = 0,
  className = "",
}: Props) {
  const widget = useRef<TurnstileInstance>(undefined);
  const [generation, setGeneration] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const [ready, setReady] = useState(false);
  const [size, setSize] = useState<"compact" | "flexible">("compact");
  const onClearRef = useRef(onClear);
  useEffect(() => {
    onClearRef.current = onClear;
  }, [onClear]);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 640px)");
    const update = () => setSize(media.matches ? "flexible" : "compact");
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (ready) return;
    const timer = window.setTimeout(() => setSlow(true), SLOW_CHECK_MS);
    return () => window.clearTimeout(timer);
  }, [generation, resetSignal, ready]);
  useEffect(() => {
    if (!resetSignal) return;
    setReady(false);
    setMessage(null);
    setSlow(false);
    widget.current?.reset();
  }, [resetSignal]);
  const retry = () => {
    // A failed script tag otherwise prevents the library from injecting it again.
    if (!window.turnstile) document.getElementById(SCRIPT_ID)?.remove();
    onClearRef.current();
    setReady(false);
    setSlow(false);
    setMessage(null);
    setGeneration((value) => value + 1);
  };
  const fail = (text: string) => {
    setReady(false);
    setMessage(text);
    onClearRef.current();
  };
  return (
    <div className={`w-full max-w-[300px] ${className}`}>
      {siteKey ? (
        <Turnstile
          key={generation}
          ref={widget}
          siteKey={siteKey}
          scriptOptions={{
            id: SCRIPT_ID,
            onError: () =>
              fail(
                "The security check could not load. Check your connection or content blocker, then retry.",
              ),
          }}
          onSuccess={(token) => {
            setReady(true);
            setMessage(null);
            setSlow(false);
            onVerify(token);
          }}
          onExpire={() => fail("The security check expired. Please try again.")}
          onTimeout={() =>
            fail("The security check timed out. Please try again.")
          }
          onError={() => {
            fail(
              "The security check could not load. Check your connection or content blocker, then retry.",
            );
            return true;
          }}
          onUnsupported={() =>
            fail(
              "This browser could not complete verification. Please try an updated browser.",
            )
          }
          options={{
            action,
            theme: "dark",
            size,
            retry: "never",
            refreshExpired: "manual",
            refreshTimeout: "manual",
            responseField: false,
          }}
        />
      ) : (
        <p role="alert" className="text-sm leading-6 text-[var(--ink)]">
          Security verification is not configured. Please contact support.
        </p>
      )}
      {siteKey && !ready && !message && (
        <p
          role="status"
          className="mt-3 text-sm leading-6 text-[var(--ink-muted)]"
        >
          {slow
            ? "This is taking longer than expected. You can retry the check or cancel and keep browsing."
            : "Preparing the security check…"}
        </p>
      )}
      {message && (
        <p role="alert" className="mt-3 text-sm leading-6 text-[var(--ink)]">
          {message}
        </p>
      )}
      {siteKey && (message || slow) && (
        <button
          type="button"
          onClick={retry}
          className="ui-secondary-action mt-3 w-full"
        >
          Try security check again
        </button>
      )}
    </div>
  );
}
