"use client";

import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import Link from "next/link";
import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, Info, Loader2 } from "lucide-react";
import { SupportEmailLink } from "@/components/ui/support-email-link";

export function AuthFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`auth-frame mx-auto w-full max-w-md ${className}`}>{children}</div>;
}

export function AuthBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2 ${compact ? "mb-6" : "mb-8"}`}>
      <Link href="/" aria-label="Moodies homepage" className="auth-brand inline-flex min-h-11 items-center gap-2.5 rounded-sm focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]">
        <Image src="/images/moodies-transparent.png" alt="" width={36} height={36} className="h-9 w-9 object-contain" priority />
        <span data-display className="text-2xl font-bold tracking-normal text-[var(--ink)]">Moodies</span>
      </Link>
      <Link href="/" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md border border-[var(--surface-border)] bg-white/5 px-2 text-sm font-semibold text-[var(--brand-coral-strong)] transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral-strong)] md:hidden">
        <ArrowLeft size={16} aria-hidden="true" />
        Back to home
      </Link>
    </div>
  );
}

export function AuthHeader({ title, children, compact = false, titleSide }: { title: string; children?: ReactNode; compact?: boolean; titleSide?: ReactNode }) {
  return (
    <header className={compact ? "mb-6" : "mb-8"}>
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-4xl font-bold leading-none text-[var(--ink)] sm:text-5xl">{title}</h1>
        {titleSide}
      </div>
      {children && <div className="mt-3 max-w-sm text-sm leading-6 text-[var(--ink-muted)]">{children}</div>}
    </header>
  );
}

export function AuthLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="rounded-sm font-semibold text-[var(--brand-coral-strong)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]">{children}</Link>;
}

type AuthInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  icon?: ReactNode;
  rightSlot?: ReactNode;
  labelSide?: ReactNode;
  hint?: string;
};

export function AuthInput({ label, icon, rightSlot, labelSide, hint, className = "", id, ...props }: AuthInputProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const hintId = `${inputId}-hint`;
  return (
    <div className="auth-field space-y-2">
      <div className="flex items-center justify-between gap-3">
        {label && <label htmlFor={inputId} className="auth-field-label text-sm font-semibold text-[var(--ink)]">{label}</label>}
        {labelSide}
      </div>
      <div className="relative">
        {icon && <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[var(--ink-muted)]">{icon}</div>}
        <input {...props} id={inputId} aria-describedby={[props["aria-describedby"], hint ? hintId : null].filter(Boolean).join(" ") || undefined}
          className={`h-12 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-1)] text-base text-[var(--ink)] placeholder:text-[var(--ink-muted)] outline-none transition-colors hover:border-[var(--ink-muted)] focus:border-[var(--brand-coral-strong)] focus:ring-2 focus:ring-[var(--brand-coral-strong)]/20 disabled:cursor-not-allowed disabled:opacity-60 ${icon ? "pl-11" : "pl-4"} ${rightSlot ? "pr-14" : "pr-4"} ${className}`} />
        {rightSlot}
      </div>
      {hint && <p id={hintId} className="text-xs leading-5 text-[var(--ink-muted)]">{hint}</p>}
    </div>
  );
}

export function AuthPasswordInput({ shown, onToggle, ...props }: Omit<AuthInputProps, "type" | "rightSlot"> & { shown: boolean; onToggle: () => void }) {
  return <AuthInput {...props} type={shown ? "text" : "password"} rightSlot={
    <button type="button" onClick={onToggle} aria-label={shown ? "Hide password" : "Show password"} aria-pressed={shown}
      className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-md text-[var(--ink-muted)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]">
      {shown ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
    </button>
  } />;
}

export function AuthButton({ children, loading = false, loadingText = "Working…", type = "submit", disabled, onClick }: {
  children: ReactNode; loading?: boolean; loadingText?: string; type?: "button" | "submit"; disabled?: boolean; onClick?: () => void;
}) {
  return <button type={type} disabled={disabled || loading} onClick={onClick} aria-busy={loading}
    className="ui-primary-action h-12 w-full shadow-none disabled:cursor-not-allowed disabled:opacity-60">
    {loading ? <><Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden />{loadingText}</> : children}
  </button>;
}

export function AuthMessage({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "info" | "success" }) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "info" ? Info : AlertCircle;
  return <div role={tone === "error" ? "alert" : "status"} className="flex items-start gap-2 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-1)] p-3 text-sm leading-6 text-[var(--ink)]">
    <Icon className="mt-1 h-4 w-4 shrink-0 text-[var(--brand-coral-strong)]" aria-hidden />
    <p>{children}</p>
  </div>;
}

export function AuthSupportNote({ className = "" }: { className?: string }) {
  return <p className={`text-xs leading-5 text-[var(--ink-muted)] ${className}`}>Need a hand? <SupportEmailLink />.</p>;
}

export function AuthDivider({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return <div className={`flex items-center gap-3 ${compact ? "my-5" : "my-6"}`}>
    <div className="h-px flex-1 bg-[var(--surface-border)]" />
    <span className="text-xs text-[var(--ink-muted)]">{children}</span>
    <div className="h-px flex-1 bg-[var(--surface-border)]" />
  </div>;
}
function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.72 1.22 9.23 3.6l6.9-6.9C35.9 2.2 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l8.36 6.49C12.7 13.64 17.9 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24c0-1.64-.15-3.2-.43-4.7H24v9h12.7c-.55 2.97-2.22 5.5-4.72 7.2l7.2 5.58C43.84 37.72 46.5 31.36 46.5 24z"
      />
      <path
        fill="#FBBC04"
        d="M11 27.71A14.46 14.46 0 0 1 10.5 24c0-1.29.18-2.54.5-3.71L2.64 13.22A23.902 23.902 0 0 0 0 24c0 3.86.92 7.5 2.56 10.78l8.44-7.07z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.42 0 11.82-2.12 15.76-5.8l-7.2-5.58C30.37 38.5 27.42 39.5 24 39.5c-6.1 0-11.3-4.14-13.08-9.71l-8.36 6.99C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}


export function GoogleButton({ loading, onClick, children }: { loading?: boolean; onClick: () => void; children?: ReactNode }) {
  return <button type="button" onClick={onClick} disabled={loading} className="ui-secondary-action h-12 w-full disabled:cursor-not-allowed disabled:opacity-60">
    <GoogleIcon />{loading ? "Connecting…" : children || "Continue with Google"}
  </button>;
}
