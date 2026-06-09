import nodemailer from 'nodemailer';

// Nodemailer does not ship local project typings here, so keep the unsafe edge at the transport boundary.
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

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
  supportEmail: process.env.MAIL_SUPPORT || 'support@moodies.com',
  appUrl: APP_URL,
  mascotUrl:
    process.env.MOODIES_MASCOT_URL || `${APP_URL}/images/moodies-mascot.png`,
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
  const safeSupportEmail = escapeHtml(MOODIES_BRAND.supportEmail);
  const safeMascotUrl = escapeHtml(MOODIES_BRAND.mascotUrl);
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>${safeTitle}</title>
  </head>

  <body style="margin:0; padding:0; background:transparent; font-family:Arial, Helvetica, sans-serif; color:#f8fafc;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
      ${safePreviewText}
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0; padding:0; background:transparent;">
      <tr>
        <td align="center" style="padding:34px 14px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px; overflow:hidden; border-radius:28px; border:1px solid rgba(255,255,255,0.14); background:#0b0b0b; box-shadow:0 24px 80px rgba(0,0,0,0.58);">
            <tr>
              <td style="padding:0; background:#0b0b0b;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:radial-gradient(circle at 82% 0%, rgba(233,79,55,0.28), transparent 42%), radial-gradient(circle at 18% 12%, rgba(255,255,255,0.06), transparent 28%), #0b0b0b;">
                  <tr>
                    <td style="padding:28px 28px 22px 28px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td align="left" style="vertical-align:middle;">
                            <div style="font-size:12px; line-height:16px; letter-spacing:4px; font-weight:700; color:#ffffff; text-transform:uppercase;">
                              Moodies
                            </div>
                            <div style="width:48px; height:2px; margin-top:14px; background:#e94f37; border-radius:999px; box-shadow:0 0 18px rgba(233,79,55,0.55);"></div>
                          </td>
                          <td align="right" style="vertical-align:middle;">
                            <img
                              src="${safeMascotUrl}"
                              width="70"
                              height="70"
                              alt="Moodies mascot"
                              style="display:block; border:0; outline:none; text-decoration:none; border-radius:20px; background:rgba(233,79,55,0.10);"
                            />
                          </td>
                        </tr>
                      </table>

                      <div style="margin-top:26px; font-size:11px; line-height:16px; letter-spacing:2.4px; font-weight:700; color:#e94f37; text-transform:uppercase;">
                        ${safeEyebrow}
                      </div>

                      <h1 style="margin:8px 0 0 0; font-size:34px; line-height:38px; color:#e94f37; font-weight:900; letter-spacing:0.4px; text-transform:uppercase;">
                        ${safeTitle}
                      </h1>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 28px 6px 28px;">
                <p style="margin:0 0 14px 0; font-size:16px; line-height:25px; color:#ffffff; font-weight:700;">
                  ${safeGreeting}
                </p>

                <p style="margin:0; font-size:15px; line-height:25px; color:rgba(255,255,255,0.72);">
                  ${safeMessage}
                </p>
              </td>
            </tr>

            ${
              safeCode
                ? `
            <tr>
              <td style="padding:26px 28px 6px 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-radius:22px; border:1px solid rgba(233,79,55,0.36); background:linear-gradient(135deg, rgba(233,79,55,0.16), rgba(255,255,255,0.04));">
                  <tr>
                    <td align="center" style="padding:24px 18px;">
                      <div style="font-size:11px; line-height:16px; letter-spacing:2.5px; font-weight:800; color:rgba(255,255,255,0.46); text-transform:uppercase;">
                        Verification code
                      </div>
                      <div style="margin-top:10px; font-size:42px; line-height:48px; letter-spacing:10px; font-weight:900; color:#ffffff;">
                        ${safeCode}
                      </div>
                      <div style="margin-top:10px; font-size:13px; line-height:20px; color:rgba(255,255,255,0.54);">
                        This code expires in 10 minutes.
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            `
                : ''
            }

            ${
              safeCtaLabel && safeCtaUrl
                ? `
            <tr>
              <td align="center" style="padding:28px 28px 6px 28px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="center" bgcolor="#e94f37" style="border-radius:14px; box-shadow:0 12px 28px rgba(233,79,55,0.32);">
                      <a
                        href="${safeCtaUrl}"
                        target="_blank"
                        style="display:inline-block; min-width:180px; padding:14px 24px; font-size:14px; font-weight:800; color:#ffffff; text-decoration:none; border-radius:14px; background:#e94f37;"
                      >
                        ${safeCtaLabel}
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            `
                : ''
            }

            <tr>
              <td style="padding:26px 28px 30px 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-radius:18px; border:1px solid rgba(255,255,255,0.10); background:rgba(255,255,255,0.045);">
                  <tr>
                    <td style="padding:17px 18px;">
                      <p style="margin:0; font-size:13px; line-height:21px; color:rgba(255,255,255,0.58);">
                        ${safeSupportNote}
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:22px 28px; background:#070707; border-top:1px solid rgba(255,255,255,0.10);">
                <p style="margin:0 0 8px 0; font-size:13px; line-height:20px; color:rgba(255,255,255,0.52);">
                  ${safeFooterNote}
                </p>

                <p style="margin:0; font-size:13px; line-height:20px; color:rgba(255,255,255,0.42);">
                  Need help? Contact
                  <a href="mailto:${safeSupportEmail}" style="color:#ffb199; text-decoration:none; font-weight:700;">
                    ${safeSupportEmail}
                  </a>
                </p>

                <p style="margin:16px 0 0 0; font-size:12px; line-height:18px; color:rgba(255,255,255,0.28);">
                  Copyright ${currentYear} Moodies. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
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
  const mailOptions = {
    from: `"Moodies Support" <${process.env.MAIL_USER}>`,
    to: email,
    subject,
    text: createPlainTextEmail(templateOptions),
    html: createMoodiesEmailTemplate(templateOptions),
  };

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  await transporter.sendMail(mailOptions);
}

export async function sendVerificationCode(email: string, code: string) {
  const verifyUrl = `${MOODIES_BRAND.appUrl}/auth/verify-code?email=${encodeURIComponent(
    email,
  )}`;

  await sendMoodiesEmail(email, 'Your Moodies password reset code', {
    title: 'Reset password',
    eyebrow: 'Security check',
    previewText: 'Use your Moodies verification code to reset your password.',
    greeting: 'Hi Moodies friend,',
    message:
      'We received a request to reset your Moodies account password. Enter the code below in the Moodies app to continue.',
    code,
    ctaLabel: 'Open Moodies',
    ctaUrl: verifyUrl,
    supportNote:
      'Moodies will never ask you to share your password or verification code outside the official app.',
    footerNote:
      'This email was sent because someone requested password recovery for your Moodies account.',
  });

  console.log(`Sent password reset verification code to ${email}`);
}
