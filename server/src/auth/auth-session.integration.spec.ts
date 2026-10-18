import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AuthSessionService } from './auth-session.service';

// Explicit opt-in only. Each run creates and removes its own isolated schema.
const testUrl = process.env.AUTH_SESSION_TEST_DATABASE_URL;
(testUrl ? describe : describe.skip)('PostgreSQL session migration and rotation', () => {
  const schema = `auth_session_test_${randomBytes(8).toString('hex')}`;
  const url = new URL(testUrl || 'postgresql://localhost/unused');
  url.searchParams.set('schema', schema);
  const admin = new PrismaClient({ datasourceUrl: testUrl });
  const db = new PrismaClient({ datasourceUrl: url.toString() });
  const originalSecret = process.env.JWT_SECRET;
  const redis = { getSessionWithTtl: jest.fn(), deleteSessionKeys: jest.fn() };
  const service = new AuthSessionService(
    db as unknown as ConstructorParameters<typeof AuthSessionService>[0],
    redis as unknown as ConstructorParameters<typeof AuthSessionService>[1],
  );

  beforeAll(async () => {
    if (!/^auth_session_test_[a-f0-9]{16}$/.test(schema)) throw new Error('Unsafe test schema');
    process.env.JWT_SECRET = 'synthetic-integration-test-secret';
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    // A preexisting user demonstrates that the migration handles existing records.
    await db.$executeRawUnsafe('CREATE TABLE "User" ("id" TEXT PRIMARY KEY, "email" TEXT NOT NULL)');
    await db.$executeRaw`INSERT INTO "User" ("id", "email") VALUES ('member', 'member@example.test')`;
    const migration = readFileSync(join(__dirname, '../..', 'prisma/migrations/20261018000000_add_durable_auth_sessions/migration.sql'), 'utf8');
    for (const statement of migration.split(';').filter((sql) => sql.trim())) await db.$executeRawUnsafe(statement);
  });
  afterAll(async () => {
    await db.$disconnect();
    if (/^auth_session_test_[a-f0-9]{16}$/.test(schema)) await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.$disconnect();
    if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
  });

  it('keeps existing users and defaults their auth version', async () => {
    expect(await db.user.findUnique({ where: { id: 'member' }, select: { authVersion: true } })).toEqual({ authVersion: 0 });
  });

  it('serializes simultaneous rotations and preserves one usable successor', async () => {
    const initial = await service.create('member');
    const results = await Promise.all(Array.from({ length: 8 }, () => service.rotate(initial.refreshToken)));
    expect(results.every(Boolean)).toBe(true);
    expect(new Set(results.map((result) => result!.refreshToken)).size).toBe(1);
    const successor = results[0]!.refreshToken;
    expect((await service.rotate(successor))?.refreshToken).toBe(successor);
    expect(await db.authSession.count()).toBe(1);
    expect(redis.getSessionWithTtl).not.toHaveBeenCalled();
  });

  it('rolls back a failed rotation without spending the old token', async () => {
    const initial = await service.create('member');
    await expect(db.$transaction(async (tx) => {
      await tx.authSession.update({ where: { id: initial.session.id }, data: { revokedAt: new Date() } });
      throw new Error('simulated transaction failure');
    })).rejects.toThrow('simulated transaction failure');
    expect(await service.rotate(initial.refreshToken)).not.toBeNull();
  });

  it('enforces logout immediately for access and refresh', async () => {
    const initial = await service.create('member');
    await service.revoke(initial.refreshToken);
    expect(await service.rotate(initial.refreshToken)).toBeNull();
    expect(await service.isActive({ sub: 'member', sid: initial.session.id, ver: 0 })).toBe(false);
  });
});
