"use client";

import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import Link from "next/link";
import type { InputHTMLAttributes, ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  Loader2,
} from "lucide-react";
import { SupportEmailLink } from "@/components/ui/support-email-link";

type AuthFrameProps = {
  children: ReactNode;
  className?: string;
};

export function AuthFrame({ children, className = "" }: AuthFrameProps) {
  return (
    <div
      className={`auth-frame w-full max-w-[27rem] mx-auto py-4 sm:py-6 ${className}`}
    >
      {children}
    </div>
  );
}

type AuthBrandProps = {
  compact?: boolean;
};

export function AuthBrand({ compact = false }: AuthBrandProps) {
  return (
    <div
      className={`auth-brand flex items-center gap-2 ${
        compact ? "mb-2" : "mb-5 [@media(max-height:700px)]:mb-3"
      }`}
    >
      <Image
        src="/images/moodies-transparent.png"
        alt="Moodies"
        width={40}
        height={40}
        className={`w-auto drop-shadow ${
          compact ? "h-6" : "h-8 [@media(max-height:700px)]:h-7"
        }`}
        priority
      />
      <span
        className={`font-['Bebas_Neue'] tracking-[0.24em] text-white/90 ${
          compact ? "text-base" : "text-xl [@media(max-height:700px)]:text-lg"
        }`}
      >
        MOODIES
      </span>
    </div>
  );
}

type AuthHeaderProps = {
  title: string;
  children?: ReactNode;
  compact?: boolean;
};

export function AuthHeader({
  title,
  children,
  compact = false,
}: AuthHeaderProps) {
  return (
    <header
      className={compact ? "mb-3" : "mb-7 [@media(max-height:700px)]:mb-4"}
    >
      <h1
        className={`font-['Bebas_Neue'] leading-none tracking-[0.03em] text-[rgb(233,79,55)] ${
          compact
            ? "text-[1.75rem] sm:text-[1.9rem]"
            : "text-[2.25rem] sm:text-[2.45rem] [@media(max-height:700px)]:text-[1.9rem]"
        }`}
      >
        {title}
      </h1>
      <div
        className={`h-0.5 w-12 rounded-full bg-[rgb(233,79,55)] shadow-[0_0_20px_rgba(233,79,55,0.55)] ${
          compact ? "my-1.5" : "mt-3 mb-3 [@media(max-height:700px)]:my-2"
        }`}
      />
      {children && (
        <div
          className={`max-w-sm text-white/58 ${
            compact
              ? "text-xs leading-4"
              : "text-[0.875rem] leading-6 [@media(max-height:700px)]:text-[0.82rem] [@media(max-height:700px)]:leading-5"
          }`}
        >
          {children}
        </div>
      )}
    </header>
  );
}

type AuthLinkProps = {
  href: string;
  children: ReactNode;
};

export function AuthLink({ href, children }: AuthLinkProps) {
  return (
    <Link
      href={href}
      className="text-[0.82rem] font-semibold text-amber-300 transition-colors underline-offset-4 hover:text-amber-200 hover:underline"
    >
      {children}
    </Link>
  );
}

type AuthInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  icon?: ReactNode;
  rightSlot?: ReactNode;
};

export function AuthInput({
  label,
  icon,
  rightSlot,
  className = "",
  ...props
}: AuthInputProps) {
  return (
    <div className="auth-field space-y-2 [@media(max-height:700px)]:space-y-1.5">
      {label && (
        <label className="auth-field-label ml-1 block text-[0.84rem] font-semibold text-white/85">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/45">
            {icon}
          </div>
        )}
        <input
          {...props}
          className={`h-12 w-full rounded-xl border border-white/12 bg-white/[0.07] text-[0.92rem] text-white
                     placeholder:text-white/38 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]
                     outline-none transition-all hover:border-white/20 hover:bg-white/[0.09]
                     focus:border-amber-300/70 focus:bg-white/[0.11]
                     focus:ring-4 focus:ring-amber-300/15
                     disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/[0.035] disabled:text-white/35
                     [@media(max-height:700px)]:h-11
                     ${icon ? "pl-11" : "pl-4"} ${rightSlot ? "pr-12" : "pr-4"} ${className}`}
        />
        {rightSlot}
      </div>
    </div>
  );
}

type AuthPasswordInputProps = Omit<AuthInputProps, "type" | "rightSlot"> & {
  shown: boolean;
  onToggle: () => void;
};

export function AuthPasswordInput({
  shown,
  onToggle,
  icon,
  ...props
}: AuthPasswordInputProps) {
  return (
    <AuthInput
      {...props}
      type={shown ? "text" : "password"}
      icon={icon}
      rightSlot={
        <button
          type="button"
          onClick={onToggle}
          aria-label={shown ? "Hide password" : "Show password"}
          title={shown ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-white/60
                     transition-colors hover:bg-white/10 hover:text-white
                     focus:outline-none focus:ring-2 focus:ring-amber-300/40"
        >
          {shown ? (
            <EyeOff className="h-4 w-4" aria-hidden />
          ) : (
            <Eye className="h-4 w-4" aria-hidden />
          )}
        </button>
      }
    />
  );
}

type AuthButtonProps = {
  children: ReactNode;
  loading?: boolean;
  loadingText?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
};

export function AuthButton({
  children,
  loading = false,
  loadingText = "Working...",
  type = "submit",
  disabled,
  onClick,
}: AuthButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className="h-12 w-full rounded-xl font-bold text-sm text-white
                 bg-[rgb(233,79,55)] hover:bg-[rgb(215,65,42)]
                 shadow-[0_10px_28px_rgba(233,79,55,0.34)]
                 hover:shadow-[0_8px_24px_rgba(233,79,55,0.35)] cursor-pointer
                 transform hover:scale-[1.02] active:scale-[0.98]
                 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-amber-300/20
                 disabled:opacity-60 disabled:hover:scale-100 disabled:cursor-not-allowed
                 [@media(max-height:700px)]:h-11"
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {loadingText}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

type AuthMessageProps = {
  children: ReactNode;
  tone?: "error" | "info" | "success";
};

export function AuthMessage({ children, tone = "error" }: AuthMessageProps) {
  const styles = {
    error: "border-red-400/30 bg-red-500/12 text-red-200",
    info: "border-amber-300/30 bg-amber-300/12 text-amber-100",
    success: "border-emerald-300/30 bg-emerald-400/12 text-emerald-100",
  };
  const Icon =
    tone === "success" ? CheckCircle2 : tone === "info" ? Info : AlertCircle;

  return (
    <div className={`rounded-xl border p-3 ${styles[tone]}`}>
      <p className="flex items-start gap-2 text-[0.86rem] leading-5">
        <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
        {children}
      </p>
    </div>
  );
}

export function AuthSupportNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-center text-xs leading-5 text-white/45 ${className}`}>
      Need help? Contact us at <SupportEmailLink />.
    </p>
  );
}

export function AuthDivider({
  children,
  compact = false,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 ${
        compact ? "my-3" : "my-6 [@media(max-height:700px)]:my-4"
      }`}
    >
      <div className="h-px flex-1 bg-white/10" />
      <span className="text-xs text-white/50">{children}</span>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  );
}

type GoogleButtonProps = {
  loading?: boolean;
  onClick: () => void;
  children?: ReactNode;
};

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

export function GoogleButton({
  loading,
  onClick,
  children,
}: GoogleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label="Continue with Google"
      className="w-full relative flex h-12 items-center justify-center gap-2.5 rounded-xl px-3
                 bg-zinc-900/70 text-white text-sm border border-white/10 backdrop-blur
                 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_6px_24px_rgba(0,0,0,0.35)]
                 hover:bg-zinc-900/90 hover:border-white/20 cursor-pointer active:scale-[0.99]
                 transition-all focus:outline-none focus:ring-2 focus:ring-amber-400/70
                 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-60 disabled:cursor-not-allowed
                 [@media(max-height:700px)]:h-11"
    >
      <GoogleIcon />
      <span className="font-medium">
        {loading ? "Redirecting..." : children || "Continue with Google"}
      </span>
      <span
        className="pointer-events-none absolute inset-0 rounded-xl"
        style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" }}
      />
    </button>
  );
}

export function GoogleIconButton({
  loading,
  onClick,
}: {
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label="Continue with Google"
      title="Continue with Google"
      className="relative mx-auto flex h-9 w-9 items-center justify-center rounded-xl
                 border border-white/10 bg-zinc-900/70 backdrop-blur
                 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_6px_24px_rgba(0,0,0,0.35)]
                 transition-all hover:border-white/20 hover:bg-zinc-900/90
                 focus:outline-none focus:ring-2 focus:ring-amber-400/70
                 focus:ring-offset-2 focus:ring-offset-black disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
    </button>
  );
}

export function AuthMascotCallout() {
  return (
    <div className="mb-6 flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.055] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] [@media(max-height:700px)]:hidden">
      <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl bg-[rgb(233,79,55)]/12">
        <Image
          src="/images/moodies-mascot.png"
          alt="Moodies mascot"
          fill
          sizes="56px"
          className="object-contain p-1"
        />
      </div>
      <div>
        <p className="text-sm font-semibold text-white/88">
          Ready for a better watchlist?
        </p>
        <p className="mt-0.5 text-xs leading-5 text-white/50">
          Sign in and let Moodies tune recommendations to your taste.
        </p>
      </div>
    </div>
  );
}
