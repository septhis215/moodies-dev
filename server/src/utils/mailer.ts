import nodemailer from 'nodemailer';
import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { setTimeout as delay } from 'node:timers/promises';
import { renderPasswordResetEmail } from '../emails/password-reset.template';

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

export async function sendVerificationCode(email: string, code: string) {
  const brand = getEmailBrand();
  const resetUrl = `${brand.appUrl}/auth/verify-code?email=${encodeURIComponent(email)}`;
  const message = renderPasswordResetEmail({
    code, resetUrl, supportEmail: brand.supportEmail, appUrl: brand.appUrl,
  });
  await deliverEmail({ to: email, ...message });
  logger.log('SMTP accepted a password-reset email.');
}
