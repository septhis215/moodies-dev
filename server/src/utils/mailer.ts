import nodemailer from 'nodemailer';
import { Logger } from '@nestjs/common';

const logger = new Logger('Mailer');

// Transport selection:
//  - Local dev (NODE_ENV=development) uses Gmail SMTP — it works on a dev machine
//    and can send to any recipient without a verified domain.
//  - Staging/production send over HTTPS via Resend, because some PaaS hosts
//    block outbound SMTP (ETIMEDOUT on connect). NODE_ENV must be exactly
//    'development' for SMTP, so staging never tries (and hangs on) a blocked port.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
// Resend sender. 'Moodies <onboarding@resend.dev>' only delivers to your own
// Resend account email; set a verified-domain sender for real recipients.
const MAIL_FROM = process.env.MAIL_FROM || 'Moodies <onboarding@resend.dev>';

const useLocalSmtp =
  process.env.NODE_ENV === 'development' &&
  !!process.env.MAIL_USER &&
  !!process.env.MAIL_PASS;

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
const smtpTransporter = useLocalSmtp
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
      // Fail fast instead of hanging if SMTP is slow/unreachable.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    })
  : null;

async function deliverEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  // Local dev: real send via Gmail SMTP (any recipient, no domain needed).
  if (smtpTransporter) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await smtpTransporter.sendMail({
      from: `"Moodies Support" <${process.env.MAIL_USER}>`,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    return;
  }

  // Staging/production: HTTPS via Resend (SMTP is blocked on PaaS).
  if (!RESEND_API_KEY) {
    throw new Error(
      'No email transport configured — set MAIL_USER/MAIL_PASS for local SMTP, or RESEND_API_KEY for hosted sending.',
    );
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: MAIL_FROM,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Resend API error ${res.status}: ${detail}`);
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

const APP_URL = (process.env.CLIENT_URL || 'https://moodies.com').replace(
  /\/$/,
  '',
);

const MOODIES_BRAND = {
  name: 'Moodies',
  supportEmail: process.env.MAIL_SUPPORT || 'moodies.support@gmail.com',
  appUrl: APP_URL,
};

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

  logger.log(`Sent password reset verification email to ${email}`);
}
