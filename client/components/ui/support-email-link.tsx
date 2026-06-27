import { appConfig, supportMailtoHref } from "@/lib/app-config";

type SupportEmailLinkProps = {
  className?: string;
  subject?: string;
};

export function SupportEmailLink({
  className = "",
  subject,
}: SupportEmailLinkProps) {
  return (
    <a
      href={supportMailtoHref(subject)}
      aria-label={`Email Moodies support at ${appConfig.supportEmail}`}
      className={`rounded-sm font-semibold text-[rgb(233,79,55)] underline underline-offset-4 decoration-[rgba(233,79,55,0.45)] transition-colors hover:text-[#ff6b58] hover:decoration-[#ff6b58] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(233,79,55,0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-black ${className}`}
    >
      {appConfig.supportEmail}
    </a>
  );
}
