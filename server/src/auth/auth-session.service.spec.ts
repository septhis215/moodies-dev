import { ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AuthSessionService } from './auth-session.service';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
describe('durable authentication sessions', () => {
  const originalSecret = process.env.JWT_SECRET;
  beforeEach(() => { process.env.JWT_SECRET = 'synthetic-session-test-secret'; });
  afterEach(() => { if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret; });

  function setup() {
    const token = 's1.test-session.synthetic-token';
    let row = {
      id: 'test-session', userId: 'member', tokenHash: hash(token), previousTokenHash: null as string | null,
      previousValidUntil: null as Date | null, revokedAt: null as Date | null,
      expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date(),
      user: { id: 'member', email: 'member@example.test', authVersion: 0 },
    };
    const update = jest.fn(({ data }) => { row = { ...row, ...data }; return Promise.resolve({ ...row }); });
    const tx = {
      $queryRaw: jest.fn((sql: TemplateStringsArray, ...values: string[]) => Promise.resolve(
        sql.join('').includes('FROM "User"') ? [{ id: 'member' }] :
          values[0] === row.tokenHash || values[0] === row.previousTokenHash ? [{ id: row.id }] : [],
      )),
      authSession: { findUniqueOrThrow: jest.fn(() => Promise.resolve({ ...row })), update, upsert: jest.fn() },
      user: { findUnique: jest.fn().mockResolvedValue({ authVersion: 0 }) },
    };
    const db = {
      authSession: {
        findFirst: jest.fn().mockResolvedValue({ id: row.id }),
        create: jest.fn(), updateMany: jest.fn(), upsert: tx.authSession.upsert,
      },
      user: tx.user,
      $transaction: jest.fn((run) => run(tx)),
    };
    const redis = { getSessionWithTtl: jest.fn().mockResolvedValue(null), deleteSessionKeys: jest.fn() };
    const service = new AuthSessionService(
      db as unknown as ConstructorParameters<typeof AuthSessionService>[0],
      redis as unknown as ConstructorParameters<typeof AuthSessionService>[1],
    );
    return { service, db, redis, token, tx, row: () => row, change: (data: Partial<typeof row>) => { row = { ...row, ...data }; } };
  }

  it('rotates once and converges on the same successor for a duplicate request', async () => {
    const { service, token, row, tx, redis } = setup();
    const first = await service.rotate(token);
    const retry = await service.rotate(token);
    expect(first?.refreshToken).not.toBe(token);
    expect(retry?.refreshToken).toBe(first?.refreshToken);
    expect(row().tokenHash).toBe(hash(first!.refreshToken));
    expect(row().previousTokenHash).toBe(hash(token));
    expect(tx.authSession.update).toHaveBeenCalledTimes(1);
    expect(redis.getSessionWithTtl).not.toHaveBeenCalled();
  });

  it('does not advance the successor again while an earlier response can still arrive', async () => {
    const { service, token, tx } = setup();
    const first = await service.rotate(token);
    const next = await service.rotate(first!.refreshToken);
    expect(next?.refreshToken).toBe(first?.refreshToken);
    expect(tx.authSession.update).toHaveBeenCalledTimes(1);
  });

  it('keeps the absolute expiry fixed through renewal', async () => {
    const { service, token, row } = setup();
    const expiresAt = row().expiresAt;
    expect((await service.rotate(token))?.session.expiresAt).toEqual(expiresAt);
  });

  it('revokes the session when the previous token is reused outside the grace period', async () => {
    const { service, token, change, row } = setup();
    await service.rotate(token);
    change({ previousValidUntil: new Date(Date.now() - 1) });
    expect(await service.rotate(token)).toBeNull();
    expect(row().revokedAt).toBeInstanceOf(Date);
  });

  it.each(['expired', 'revoked'])('rejects an %s session', async (kind) => {
    const { service, token, change, tx } = setup();
    change(kind === 'expired' ? { expiresAt: new Date(0) } : { revokedAt: new Date() });
    expect(await service.rotate(token)).toBeNull();
    expect(tx.authSession.update).not.toHaveBeenCalled();
  });

  it('reports database failures as temporary and never calls them expired', async () => {
    const { service, token, db } = setup();
    db.$transaction.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(service.rotate(token)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('imports a valid legacy token with only its remaining Redis lifetime', async () => {
    const { service, db, redis } = setup();
    db.authSession.findFirst.mockResolvedValueOnce(null);
    redis.getSessionWithTtl.mockResolvedValueOnce({ value: 'member', ttlSeconds: 42 });
    await service.rotate('a'.repeat(64));
    const imported = db.authSession.upsert.mock.calls[0][0].create;
    expect(imported.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 42_000);
    expect(imported.tokenHash).toBe(hash('a'.repeat(64)));
  });

  it('rejects legacy refresh tokens after a password change', async () => {
    const { service, db, redis } = setup();
    db.authSession.findFirst.mockResolvedValueOnce(null);
    db.user.findUnique.mockResolvedValueOnce({ authVersion: 1 });
    redis.getSessionWithTtl.mockResolvedValueOnce({ value: 'member', ttlSeconds: 42 });
    expect(await service.rotate('a'.repeat(64))).toBeNull();
    expect(db.authSession.upsert).not.toHaveBeenCalled();
  });

  it('checks revocation and auth version on access requests', async () => {
    const { service, db } = setup();
    expect(await service.isActive({ sub: 'member', sid: 'test-session', ver: 0 })).toBe(true);
    db.user.findUnique.mockResolvedValueOnce({ authVersion: 1 });
    expect(await service.isActive({ sub: 'member', sid: 'test-session', ver: 0 })).toBe(false);
    db.authSession.findFirst.mockResolvedValueOnce(null);
    expect(await service.isActive({ sub: 'member', sid: 'test-session', ver: 0 })).toBe(false);
  });
});
