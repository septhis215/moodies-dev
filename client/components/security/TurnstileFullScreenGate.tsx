"use client";
import { useEffect, useRef } from "react";
import { useTurnstileGate } from "@/hooks/useTurnstileGate";
import { TurnstileCaptcha } from "@/components/ui/TurnstileCaptcha";

/** Native modal provides focus trapping, Escape handling and focus restoration. */
export function TurnstileFullScreenGate() {
  const { action, complete, cancel } = useTurnstileGate();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
      aria-labelledby="turnstile-gate-title"
      aria-describedby="turnstile-gate-description"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-1)] p-5 text-[var(--ink)] shadow-2xl backdrop:bg-black/75 sm:p-8"
    >
      <p className="ui-kicker">Moodies security</p>
      <h2
        id="turnstile-gate-title"
        className="mt-3 text-xl font-bold leading-tight text-[var(--ink)] sm:text-2xl"
      >
        Quick security check
      </h2>
      <p
        id="turnstile-gate-description"
        className="mt-2 text-sm leading-6 text-[var(--ink-muted)]"
      >
        Please complete this check to continue your request. You can cancel and
        keep browsing.
      </p>
      <div className="mt-5 flex justify-center">
        {action && (
          <TurnstileCaptcha
            action={action}
            onVerify={complete}
            onClear={() => undefined}
          />
        )}
      </div>
      <button
        type="button"
        onClick={cancel}
        className="ui-secondary-action mt-5 w-full"
      >
        Cancel
      </button>
    </dialog>
  );
}
