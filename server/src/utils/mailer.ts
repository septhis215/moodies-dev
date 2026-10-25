import nodemailer from 'nodemailer';
import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { setTimeout as delay } from 'node:timers/promises';

const logger = new Logger('Mailer');

const MAX_PENDING_EMAILS = 20;
const pendingEmails = new Set<Promise<void>>();
let smtpTransporter: ReturnType<typeof nodemailer.createTransport> | undefined;
let shuttingDown = false;

function getTransporter() {
  if (smtpTransporter) return smtpTransporter;

  // Auth modules import this file before ConfigModule loads .env.
  const user = process.env.MAIL_USER?.trim();
  const pass = process.env.MAIL_PASS;
  if (!user || !pass) {
    throw new Error('Email is not configured: set MAIL_USER and MAIL_PASS.');
  }
  const port = Number(process.env.SMTP_PORT || 465);
  if (port !== 465 && port !== 587) {
    throw new Error('SMTP_PORT must be 465 (TLS) or 587 (STARTTLS).');
  }
  smtpTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST?.trim() || 'smtp.hostinger.com',
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user, pass },
    pool: true,
    maxConnections: 2,
    maxMessages: 100,
    // Retry only explicit SMTP rejections below; a dropped connection can be ambiguous.
    maxRequeues: 0,
    dnsTimeout: 5_000,
    connectionTimeout: 10_000,
    greetingTimeout: 5_000,
    socketTimeout: 15_000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return smtpTransporter;
}

@Injectable()
export class MailerLifecycle implements OnApplicationShutdown {
  async onApplicationShutdown() {
    shuttingDown = true;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.allSettled([...pendingEmails]),
        new Promise<void>((resolve) => {
          timeout = setTimeout(resolve, 25_000);
        }),
      ]);
      if (pendingEmails.size) {
        logger.warn(`Email shutdown deadline reached with ${pendingEmails.size} pending deliveries.`);
      }
    } finally {
      clearTimeout(timeout);
      smtpTransporter?.close();
      smtpTransporter = undefined;
    }
  }
}

async function deliverEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  if (shuttingDown || pendingEmails.size >= MAX_PENDING_EMAILS) {
    throw new Error('Email delivery is temporarily at capacity.');
  }
  const transport = getTransporter();
  const delivery = (async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        await transport.sendMail({
          from: process.env.MAIL_FROM?.trim() || `Moodies <${process.env.MAIL_USER?.trim()}>`,
          replyTo: process.env.MAIL_SUPPORT?.trim() || process.env.MAIL_USER?.trim(),
          ...opts,
        });
        return;
      } catch (error) {
        const smtpError = error as { responseCode?: number; command?: string } | null;
        if (
          attempt > 0 ||
          !smtpError?.responseCode ||
          smtpError.responseCode < 400 ||
          smtpError.responseCode >= 500 ||
          smtpError.command?.startsWith('AUTH')
        ) {
          throw error;
        }
        logger.warn(`SMTP temporarily rejected a delivery (${smtpError.responseCode}); retrying once.`);
        await delay(1_000);
      }
    }
  })();
  pendingEmails.add(delivery);
  try {
    await delivery;
  } finally {
    pendingEmails.delete(delivery);
  }
}

type MoodiesEmailTemplateOptions = {
  title: string;
  previewText?: string;
  eyebrow?: string;
  greeting?: string;
  message: string;
  code?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  supportNote?: string;
  footerNote?: string;
};

function getEmailBrand() {
  const appUrl = process.env.CLIENT_URL?.trim();
  if (!appUrl) throw new Error('CLIENT_URL is required for email links.');
  const url = new URL(appUrl);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('CLIENT_URL must be an HTTP or HTTPS URL.');
  }
  if (process.env.NODE_ENV !== 'development' && url.protocol !== 'https:') {
    throw new Error('Hosted email links require an HTTPS CLIENT_URL.');
  }
  return {
    name: 'Moodies',
    supportEmail: process.env.MAIL_SUPPORT?.trim() || 'support@moodies.tech',
    appUrl: appUrl.replace(/\/$/, ''),
  };
}

const SUPPORT_EMAIL_SUBJECT = 'Moodies Support Request';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function supportMailtoHref(email: string) {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(
    SUPPORT_EMAIL_SUBJECT,
  )}`;
}

function createMoodiesEmailTemplate(options: MoodiesEmailTemplateOptions) {
  const MOODIES_BRAND = getEmailBrand();
  const {
    title,
    previewText = 'A message from Moodies',
    eyebrow = 'Account update',
    greeting = 'Hi there,',
    message,
    code,
    ctaLabel,
    ctaUrl,
    supportNote = `If you did not request this email, you can safely ignore it or contact ${MOODIES_BRAND.supportEmail}.`,
    footerNote = `You are receiving this email because of activity related to your ${MOODIES_BRAND.name} account.`,
  } = options;

  const safeTitle = escapeHtml(title);
  const safePreviewText = escapeHtml(previewText);
  const safeEyebrow = escapeHtml(eyebrow);
  const safeGreeting = escapeHtml(greeting);
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br />');
  const safeSupportNote = escapeHtml(supportNote);
  const safeFooterNote = escapeHtml(footerNote);
  const safeCode = code ? escapeHtml(code) : '';
  const safeCtaLabel = ctaLabel ? escapeHtml(ctaLabel) : '';
  const safeCtaUrl = ctaUrl ? escapeHtml(ctaUrl) : '';
  const safeSupportHref = escapeHtml(
    supportMailtoHref(MOODIES_BRAND.supportEmail),
  );
  const currentYear = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>${safeTitle}</title>
    <style>
      body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
      table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
      @media screen and (max-width:600px) {
        .email-shell { padding:24px 12px !important; }
        .email-content { padding:28px 24px !important; }
        .email-title { font-size:28px !important; line-height:34px !important; }
        .email-code { font-size:32px !important; letter-spacing:5px !important; }
      }
    </style>
  </head>
  <body style="margin:0; padding:0; width:100%; background-color:#0b0909; font-family:Arial, Helvetica, sans-serif; color:#f5f1ed;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all; font-size:1px; line-height:1px; color:#0b0909;">
      ${safePreviewText}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#0b0909">
      <tr>
        <td class="email-shell" align="center" style="padding:48px 20px;">
          <!--[if mso]><table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">
            <tr>
              <td style="padding:0 0 24px;">
                <p style="margin:0; font-size:26px; line-height:32px; font-weight:700; letter-spacing:-0.5px; color:#f5f1ed;">Moodies<span style="color:#ff765f;">.</span></p>
                <p style="margin:5px 0 0; font-size:13px; line-height:20px; color:#b9aca7;">Stories for every mood.</p>
              </td>
            </tr>
            <tr>
              <td bgcolor="#151112" style="background-color:#151112; border:1px solid #35292a; border-top:3px solid #f0644b; border-radius:16px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td class="email-content" style="padding:36px 32px;">
                      <p style="margin:0 0 12px; font-size:11px; line-height:16px; font-weight:700; letter-spacing:1.8px; text-transform:uppercase; color:#ff765f;">${safeEyebrow}</p>
                      <h1 class="email-title" style="margin:0 0 24px; font-size:32px; line-height:38px; font-weight:700; letter-spacing:-0.5px; color:#f5f1ed;">${safeTitle}</h1>
                      <p style="margin:0 0 12px; font-size:15px; line-height:24px; color:#f5f1ed;">${safeGreeting}</p>
                      <p style="margin:0; font-size:15px; line-height:24px; color:#b9aca7;">${safeMessage}</p>
                      ${safeCode ? `
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:28px;">
                        <tr>
                          <td align="center" bgcolor="#1d1718" style="padding:24px 12px; background-color:#1d1718; border:1px solid #35292a; border-radius:12px;">
                            <p style="margin:0 0 12px; font-size:11px; line-height:16px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:#b9aca7;">Your verification code</p>
                            <p class="email-code" style="margin:0; font-family:'Courier New', Courier, monospace; font-size:36px; line-height:44px; font-weight:700; letter-spacing:6px; color:#f5f1ed;">${safeCode}</p>
                            <p style="margin:12px 0 0; font-size:13px; line-height:20px; color:#b9aca7;">Expires in <strong style="color:#f5f1ed; font-weight:700;">10 minutes</strong></p>
                          </td>
                        </tr>
                      </table>` : ''}
                      ${safeCtaLabel && safeCtaUrl ? `
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px;">
                        <tr>
                          <td align="center" bgcolor="#f0644b" style="background-color:#f0644b; border-radius:8px; mso-padding-alt:14px 22px;">
                            <a href="${safeCtaUrl}" target="_blank" style="display:inline-block; padding:14px 22px; border:1px solid #f0644b; border-radius:8px; font-size:14px; line-height:20px; font-weight:700; text-decoration:none; color:#0b0909;">${safeCtaLabel}</a>
                          </td>
                        </tr>
                      </table>` : ''}
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:28px;">
                        <tr>
                          <td style="padding-top:24px; border-top:1px solid #35292a;">
                            <p style="margin:0; font-size:13px; line-height:21px; color:#b9aca7;">${safeSupportNote}</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 4px 0;">
                <p style="margin:0; font-size:12px; line-height:20px; color:#b9aca7;">${safeFooterNote}</p>
                <p style="margin:10px 0 0; font-size:12px; line-height:20px; color:#b9aca7;">Need a hand? <a href="${safeSupportHref}" style="color:#ff765f; text-decoration:underline;">Contact Moodies support</a></p>
                <p style="margin:16px 0 0; font-size:12px; line-height:18px; color:#b9aca7;">&copy; ${currentYear} Moodies</p>
              </td>
            </tr>
          </table>
          <!--[if mso]></td></tr></table><![endif]-->
        </td>
      </tr>
    </table>
  </body>
</html>`;

}

function createPlainTextEmail(options: MoodiesEmailTemplateOptions) {
  const MOODIES_BRAND = getEmailBrand();
  const {
    title,
    greeting = 'Hi there,',
    message,
    code,
    ctaLabel,
    ctaUrl,
    supportNote = `If you did not request this email, you can safely ignore it or contact ${MOODIES_BRAND.supportEmail}.`,
    footerNote = `You are receiving this email because of activity related to your ${MOODIES_BRAND.name} account.`,
  } = options;

  return [
    title,
    '',
    greeting,
    '',
    message,
    '',
    code ? `Verification code: ${code}` : '',
    code ? 'This code expires in 10 minutes.' : '',
    '',
    ctaLabel && ctaUrl ? `${ctaLabel}: ${ctaUrl}` : '',
    '',
    supportNote,
    '',
    footerNote,
    '',
    `Need help? Contact ${MOODIES_BRAND.supportEmail}`,
    `Copyright ${new Date().getFullYear()} Moodies. All rights reserved.`,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function sendMoodiesEmail(
  email: string,
  subject: string,
  templateOptions: MoodiesEmailTemplateOptions,
) {
  await deliverEmail({
    to: email,
    subject,
    text: createPlainTextEmail(templateOptions),
    html: createMoodiesEmailTemplate(templateOptions),
  });
}

export async function sendVerificationCode(email: string, code: string) {
  const MOODIES_BRAND = getEmailBrand();
  const verifyUrl = `${MOODIES_BRAND.appUrl}/auth/verify-code?email=${encodeURIComponent(
    email,
  )}`;

  await sendMoodiesEmail(email, 'Your Moodies password reset code', {
    title: 'Reset your password',
    eyebrow: 'Account recovery',
    previewText: 'Use your Moodies verification code to reset your password.',
    greeting: 'Hi there,',
    message:
      'Let’s get you back to your next watch. Enter this code on the password reset screen to choose a new password.',
    code,
    ctaLabel: 'Continue password reset',
    ctaUrl: verifyUrl,
    supportNote:
      'Didn’t request this? You can ignore this email. Your password will stay the same. Keep this code private; Moodies will never ask you to share it.',
    footerNote:
      'You received this email because a password reset was requested for your Moodies account.',
  });

  logger.log('SMTP accepted a password-reset email.');
}
