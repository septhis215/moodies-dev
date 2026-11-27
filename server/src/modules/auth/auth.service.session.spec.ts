import { UnauthorizedException } from '@nestjs/common';
import * as argon from 'argon2';
import { AuthService } from './auth.service';

jest.mock('argon2', () => ({ hash: jest.fn().mockResolvedValue('synthetic-hash'), verify: jest.fn().mockResolvedValue(true) }));
jest.mock('uuid', () => ({ v4: () => 'synthetic-uuid' }));

describe('authentication session boundaries', () => {
  function setup() {
    const db = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'member', password: 'old-hash' }), update: jest.fn().mockResolvedValue({ id: 'member' }) },
      authSession: { updateMany: jest.fn() },
      emailVerification: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      $transaction: jest.fn(),
    };
    db.$transaction.mockImplementation((run) => run(db));
    const jwt = { sign: jest.fn(), verifyAsync: jest.fn().mockResolvedValue({ sub: 'member', sid: 'session' }) };
    const sessions = { isActive: jest.fn().mockResolvedValue(true) };
    const service = new AuthService(
      db as unknown as ConstructorParameters<typeof AuthService>[0],
      jwt as unknown as ConstructorParameters<typeof AuthService>[1],
      {} as ConstructorParameters<typeof AuthService>[2],
      {} as ConstructorParameters<typeof AuthService>[3],
      sessions as unknown as ConstructorParameters<typeof AuthService>[4],
    );
    return { db, jwt, sessions, service };
  }

  it('revokes all sessions and increments auth version in the password-change transaction', async () => {
    const { service, db } = setup();
    await service.changePassword('member', { oldPassword: 'old-password', newPassword: 'new-password' });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: 'member' }, data: { password: 'synthetic-hash', authVersion: { increment: 1 } } });
    expect(db.authSession.updateMany).toHaveBeenCalledWith({ where: { userId: 'member', revokedAt: null }, data: { revokedAt: expect.any(Date) } });
  });

  it('does not revoke a session when the old password is incorrect', async () => {
    const { service, db } = setup();
    jest.mocked(argon.verify).mockResolvedValueOnce(false);
    await expect(service.changePassword('member', { oldPassword: 'wrong', newPassword: 'new-password' })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('atomically consumes unexpired reset verification and revokes existing sessions', async () => {
    const { service, db } = setup();
    expect(await service.resetPassword('Member@Example.test', 'new-password')).toMatchObject({ success: true });
    expect(db.emailVerification.updateMany).toHaveBeenCalledWith({
      where: { email: 'member@example.test', verified: true, expiresAt: { gt: expect.any(Date) } }, data: { verified: false },
    });
    expect(db.user.update).toHaveBeenCalledWith({ where: { email: 'member@example.test' }, data: { password: 'synthetic-hash', authVersion: { increment: 1 } } });
    expect(db.authSession.updateMany).toHaveBeenCalledTimes(1);
  });

  it('does not change credentials without valid reset verification', async () => {
    const { service, db } = setup();
    db.emailVerification.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await service.resetPassword('member@example.test', 'new-password')).toMatchObject({ success: false });
    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.authSession.updateMany).not.toHaveBeenCalled();
  });

  it('propagates a session-store outage instead of returning a successful guest bootstrap', async () => {
    const { service, sessions } = setup();
    sessions.isActive.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(service.getBootstrapFromAccessToken('synthetic-jwt')).rejects.toThrow('database unavailable');
  });

  it('returns guest bootstrap for a genuinely expired JWT', async () => {
    const { service, jwt } = setup();
    jwt.verifyAsync.mockRejectedValueOnce(new Error('jwt expired'));
    await expect(service.getBootstrapFromAccessToken('synthetic-jwt')).resolves.toMatchObject({ user: null, isAuthenticated: false });
  });
});
