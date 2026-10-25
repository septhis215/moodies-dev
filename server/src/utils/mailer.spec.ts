const sendMail = jest.fn();
const close = jest.fn();
const createTransport = jest.fn((..._args: unknown[]) => ({ sendMail, close }));

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: { createTransport: (...args: unknown[]) => createTransport(...args) },
}));

describe('Hostinger email delivery', () => {
  const originalEnv = process.env;
  let mailer: typeof import('./mailer');
  const send = () => mailer.sendVerificationCode('member@example.test', '123456');

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv, NODE_ENV: 'production' };
    for (const key of ['MAIL_USER', 'MAIL_PASS', 'MAIL_FROM', 'MAIL_SUPPORT', 'CLIENT_URL', 'SMTP_HOST', 'SMTP_PORT']) {
      delete process.env[key];
    }
    // Import before configuration, just as Nest imports AuthModule before loading .env.
    mailer = jest.requireActual<typeof import('./mailer')>('./mailer');
    jest.requireActual<typeof import('@nestjs/common')>('@nestjs/common').Logger.overrideLogger(false);
    Object.assign(process.env, {
      MAIL_USER: 'support@moodies.tech',
      MAIL_PASS: 'synthetic-password',
      MAIL_SUPPORT: 'support@moodies.tech',
      CLIENT_URL: 'https://dev.moodies.tech/',
    });
    sendMail.mockResolvedValue({ accepted: ['member@example.test'] });
  });

  afterEach(async () => {
    await new mailer.MailerLifecycle().onApplicationShutdown();
    jest.useRealTimers();
    jest.restoreAllMocks();
    process.env = originalEnv;
  });

  it('reads configuration after import, reuses a bounded TLS pool, and sends both email formats', async () => {
    await send();
    await send();
    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: 'smtp.hostinger.com', port: 465, secure: true, requireTLS: false,
      pool: true, maxConnections: 2, maxRequeues: 0,
      connectionTimeout: 10_000, socketTimeout: 15_000,
      auth: { user: 'support@moodies.tech', pass: 'synthetic-password' },
      disableFileAccess: true, disableUrlAccess: true,
    }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: 'Moodies <support@moodies.tech>',
      replyTo: 'support@moodies.tech',
      to: 'member@example.test',
      text: expect.stringContaining('https://dev.moodies.tech/auth/verify-code?email=member%40example.test'),
      html: expect.stringContaining('123456'),
    }));
  });

  it('supports STARTTLS and the configured sender without overriding it with Gmail', async () => {
    process.env.SMTP_PORT = '587';
    process.env.MAIL_FROM = 'Moodies Support <support@moodies.tech>';
    await send();
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ port: 587, secure: false, requireTLS: true }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: process.env.MAIL_FROM }));
  });

  it.each(['MAIL_USER', 'MAIL_PASS', 'CLIENT_URL'])('rejects missing %s instead of silently using an unrelated sender or site', async (key) => {
    delete process.env[key];
    await expect(send()).rejects.toThrow();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('rejects insecure hosted reset links', async () => {
    process.env.CLIENT_URL = 'http://dev.moodies.tech';
    await expect(send()).rejects.toThrow('HTTPS');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('retries an explicit temporary SMTP rejection once', async () => {
    jest.useFakeTimers();
    sendMail.mockRejectedValueOnce(Object.assign(new Error('temporarily rejected'), { responseCode: 451, command: 'DATA' }));
    const delivery = send();
    await jest.advanceTimersByTimeAsync(1000);
    await delivery;
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it('stops after one retry and releases capacity after a temporary failure', async () => {
    jest.useFakeTimers();
    const failure = Object.assign(new Error('temporarily rejected'), { responseCode: 451, command: 'DATA' });
    sendMail.mockRejectedValue(failure);
    const delivery = expect(send()).rejects.toBe(failure);
    await jest.advanceTimersByTimeAsync(1000);
    await delivery;
    expect(sendMail).toHaveBeenCalledTimes(2);
    sendMail.mockResolvedValue({ accepted: ['member@example.test'] });
    await expect(send()).resolves.toBeUndefined();
  });

  it.each([
    { responseCode: 550, command: 'RCPT TO' },
    { responseCode: 454, command: 'AUTH PLAIN' },
    { code: 'ETIMEDOUT', command: 'DATA' },
  ])('does not retry permanent/authentication failures or ambiguous network errors (%j)', async (details) => {
    const failure = Object.assign(new Error('synthetic SMTP failure'), details);
    sendMail.mockRejectedValue(failure);
    await expect(send()).rejects.toBe(failure);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('bounds pending work and restores capacity after delivery', async () => {
    let release!: (value: unknown) => void;
    sendMail.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    const releases: Array<(value: unknown) => void> = [];
    const deliveries = Array.from({ length: 20 }, () => {
      const delivery = send();
      releases.push(release);
      return delivery;
    });
    await expect(send()).rejects.toThrow('capacity');
    expect(sendMail).toHaveBeenCalledTimes(20);
    releases.forEach((resolve) => resolve({ accepted: ['member@example.test'] }));
    await Promise.all(deliveries);
    sendMail.mockResolvedValue({ accepted: ['member@example.test'] });
    await expect(send()).resolves.toBeUndefined();
  });

  it('drains pending deliveries before closing and refuses new work during shutdown', async () => {
    let release!: (value: unknown) => void;
    sendMail.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const delivery = send();
    const shutdown = new mailer.MailerLifecycle().onApplicationShutdown();
    expect(close).not.toHaveBeenCalled();
    await expect(send()).rejects.toThrow('capacity');
    release({ accepted: ['member@example.test'] });
    await Promise.all([delivery, shutdown]);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('bounds shutdown time when a delivery is stuck', async () => {
    jest.useFakeTimers();
    let release!: (value: unknown) => void;
    sendMail.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const delivery = send();
    const shutdown = new mailer.MailerLifecycle().onApplicationShutdown();
    await jest.advanceTimersByTimeAsync(25_000);
    await shutdown;
    expect(close).toHaveBeenCalledTimes(1);
    release({ accepted: ['member@example.test'] });
    await delivery;
  });
});
