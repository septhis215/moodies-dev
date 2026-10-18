import express from 'express';
import request from 'supertest';
import { ACCESS_COOKIE, REFRESH_COOKIE, clearAuthCookies, readCookie, setAuthCookies } from './auth.cookies';
import { accessTtlMs } from './auth.config';

describe('authentication cookie contract', () => {
  const originalEnv = { ...process.env };
  beforeEach(() => {
    process.env.COOKIE_SECURE = 'false';
    process.env.COOKIE_SAMESITE = 'lax';
    delete process.env.COOKIE_DOMAIN;
  });
  afterEach(() => { process.env = { ...originalEnv }; });

  function app() {
    const server = express();
    server.post('/api/auth/signin', (_req, res) => {
      setAuthCookies(res, 'synthetic-access', 'synthetic-refresh');
      res.json({ ok: true });
    });
    server.post('/api/auth/expire-access', (_req, res) => {
      res.clearCookie(ACCESS_COOKIE, { path: '/' });
      res.json({ ok: true });
    });
    server.post('/api/auth/logout', (_req, res) => {
      clearAuthCookies(res);
      res.json({ ok: true });
    });
    server.get(['/api/auth/refresh', '/public'], (req, res) => {
      res.json({ access: !!readCookie(req, ACCESS_COOKIE), refresh: !!readCookie(req, REFRESH_COOKIE) });
    });
    return server;
  }

  it('sends the refresh cookie to the prefixed endpoint after access expiry', async () => {
    const agent = request.agent(app());
    const login = await agent.post('/api/auth/signin');
    expect(login.headers['cache-control']).toBe('no-store');
    expect(login.headers['set-cookie']).toEqual(expect.arrayContaining([
      expect.stringContaining('Path=/api/auth'), expect.stringContaining('HttpOnly'),
    ]));
    await agent.post('/api/auth/expire-access');
    expect((await agent.get('/api/auth/refresh')).body).toEqual({ access: false, refresh: true });
    expect((await agent.get('/public')).body.refresh).toBe(false);
    await agent.post('/api/auth/logout');
    expect((await agent.get('/api/auth/refresh')).body).toEqual({ access: false, refresh: false });
  });

  it('uses the same configured duration for the JWT and access cookie', async () => {
    process.env.JWT_ACCESS_EXPIRES = '2m';
    const login = await request(app()).post('/api/auth/signin');
    expect(accessTtlMs()).toBe(120_000);
    expect(login.headers['set-cookie']).toEqual(expect.arrayContaining([
      expect.stringContaining('mood_at=synthetic-access; Max-Age=120;'),
    ]));
  });

  it('caps cookies at the absolute session expiry', () => {
    const cookie = jest.fn();
    setAuthCookies({ cookie, clearCookie: jest.fn(), setHeader: jest.fn() } as unknown as express.Response,
      'access', 'refresh', new Date(Date.now() + 10_000));
    expect(cookie.mock.calls.every((call) => call[2].maxAge <= 10_000)).toBe(true);
  });

  it('rejects invalid duration settings instead of issuing mismatched cookies', () => {
    process.env.JWT_ACCESS_EXPIRES = 'invalid';
    expect(accessTtlMs).toThrow('JWT_ACCESS_EXPIRES');
  });
});
