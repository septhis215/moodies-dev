export const DEFAULT_SUPPORT_EMAIL = "moodies.support@gmail.com";

export const appConfig = {
  supportEmail:
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || DEFAULT_SUPPORT_EMAIL,
};

export function supportMailtoHref(
  subject = "Moodies Support Request",
): string {
  return `mailto:${appConfig.supportEmail}?subject=${encodeURIComponent(
    subject,
  )}`;
}
