type PasswordResetEmailOptions = {
  code: string;
  resetUrl: string;
  supportEmail: string;
  appUrl: string;
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

export function renderPasswordResetEmail({
  code, resetUrl, supportEmail, appUrl,
}: PasswordResetEmailOptions) {
  const MOODIES_BRAND = { supportEmail, appUrl };
  const ctaUrl = resetUrl;
  const { title, previewText, eyebrow, greeting, message, ctaLabel, supportNote, footerNote } = {
    title: 'Reset your password',
    eyebrow: 'Account recovery',
    previewText: 'Use your Moodies verification code to reset your password.',
    greeting: 'Hi there,',
    message:
      'Enter the code below on the password reset screen to choose a new password.',
    ctaLabel: 'Continue to reset',
    supportNote:
      'Didn’t request this? You can ignore this email. Your password will stay the same. Keep this code private; Moodies will never ask you to share it.',
    footerNote:
      'You received this email because a password reset was requested for your Moodies account.',
  };

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
  const safeAppUrl = escapeHtml(MOODIES_BRAND.appUrl);
  const currentYear = new Date().getFullYear();
  // Resolve the website's type roles and color tokens inline for email clients.
  const bodyFont = "'Source Sans 3', Arial, Helvetica, sans-serif";
  const displayFont = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>${safeTitle}</title>
    <!--[if !mso]><!-->
    <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&amp;family=Source+Sans+3:wght@400;600;700;800&amp;display=swap" rel="stylesheet" />
    <!--<![endif]-->
    <style>
      :root { color-scheme:dark; supported-color-schemes:dark; }
      body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
      table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
      body, table, td, p, a { font-family:${bodyFont}; }
      h1, h2, .email-brand { font-family:${displayFont}; }
      a:focus-visible { outline:2px solid #ff765f; outline-offset:4px; }
      @media screen and (min-width:640px) {
        .email-shell { padding:48px 24px !important; }
        .email-content { padding:40px !important; }
        .email-title { font-size:36px !important; line-height:36px !important; }
      }
    </style>
    <!--[if mso]><style>body, table, td, p, a, h1, h2 { font-family:Arial, Helvetica, sans-serif !important; }</style><![endif]-->
  </head>
  <body style="margin:0; padding:0; width:100%; background-color:#0b0909; font-family:${bodyFont}; color:#f5f1ed;">
    <div aria-hidden="true" style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all; font-size:1px; line-height:1px; color:#0b0909;">
      ${safePreviewText}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#0b0909" style="background-color:#0b0909; font-family:${bodyFont};">
      <tr>
        <td class="email-shell" align="center" style="padding:32px 16px;">
          <!--[if mso]><table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">
            <tr>
              <td style="padding:0 0 24px;">
                <a class="email-brand" href="${safeAppUrl}" style="display:inline-block; font-family:${displayFont}; font-size:24px; line-height:32px; font-weight:700; letter-spacing:normal; text-decoration:none; color:#f5f1ed;">Moodies<span style="color:#ff765f;">.</span></a>
                <p style="margin:4px 0 0; font-size:14px; line-height:24px; color:#b9aca7;">Stories for every mood.</p>
              </td>
            </tr>
            <tr>
              <td bgcolor="#151112" style="background-color:#151112; border:1px solid #35292a; border-radius:12px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td class="email-content" style="padding:24px;">
                      <p style="margin:0 0 8px; font-size:11px; line-height:16px; font-weight:800; letter-spacing:1.76px; text-transform:uppercase; color:#ff765f;">${safeEyebrow}</p>
                      <h1 class="email-title" style="margin:0 0 24px; font-family:${displayFont}; font-size:30px; line-height:30px; font-weight:700; letter-spacing:normal; color:#f5f1ed;">${safeTitle}</h1>
                      <p style="margin:0 0 8px; font-size:14px; line-height:24px; font-weight:400; color:#f5f1ed;">${safeGreeting}</p>
                      <p style="margin:0; font-size:14px; line-height:24px; font-weight:400; color:#b9aca7;">${safeMessage}</p>
                      ${safeCode ? `
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px;">
                        <tr>
                          <td align="center" bgcolor="#1d1718" style="padding:24px 12px; background-color:#1d1718; border:1px solid #35292a; border-radius:8px;">
                            <p style="margin:0 0 12px; font-size:12px; line-height:16px; font-weight:600; color:#b9aca7;">Your verification code</p>
                            <p class="email-code" style="margin:0; font-family:${bodyFont}; font-size:36px; line-height:44px; font-weight:700; letter-spacing:8px; color:#f5f1ed;">${safeCode}</p>
                            <p style="margin:12px 0 0; font-size:12px; line-height:20px; color:#b9aca7;">Expires in <strong style="color:#e6b65c; font-weight:600;">10 minutes</strong></p>
                          </td>
                        </tr>
                      </table>` : ''}
                      ${safeCtaLabel && safeCtaUrl ? `
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px;">
                        <tr>
                          <td align="center" bgcolor="#f0644b" style="background-color:#f0644b; border-radius:14px; mso-padding-alt:14px 24px;">
                            <a href="${safeCtaUrl}" target="_blank" style="display:block; padding:14px 24px; border:1px solid #f0644b; border-radius:14px; font-size:14px; line-height:20px; font-weight:800; text-align:center; text-decoration:none; color:#0b0909;">${safeCtaLabel}</a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:16px 0 0; font-size:12px; line-height:20px; color:#b9aca7;">If the button doesn’t open, use this link:<br /><a href="${safeCtaUrl}" style="font-size:12px; line-height:20px; word-break:break-all; overflow-wrap:anywhere; text-decoration:underline; color:#ff765f;">${safeCtaUrl}</a></p>` : ''}
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px;">
                        <tr>
                          <td style="padding-top:24px; border-top:1px solid #35292a;">
                            <p style="margin:0; font-size:14px; line-height:24px; color:#b9aca7;">${safeSupportNote}</p>
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
                <p style="margin:12px 0 0; font-size:14px; line-height:24px; color:#b9aca7;">Need a hand? <a href="${safeSupportHref}" style="font-weight:600; color:#ff765f; text-decoration:underline;">Contact Moodies support</a></p>
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


  const text = [
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

  return { subject: 'Your Moodies password reset code', html, text };
}
