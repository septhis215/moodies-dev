import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { REFRESH_RETRY_GRACE_MS, refreshTtlMs } from './auth.config';

export type AccessIdentity = { sub?: string; sid?: string; ver?: number };
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthSessionService {
  private readonly logger = new Logger(AuthSessionService.name);

  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService) {}

  async create(userId: string) {
    const id = randomUUID();
    const refreshToken = `s1.${id}.${randomBytes(32).toString('hex')}`;
    const session = await this.prisma.authSession.create({
      data: { id, userId, tokenHash: hashToken(refreshToken), expiresAt: new Date(Date.now() + refreshTtlMs()) },
      include: { user: { select: { id: true, email: true, authVersion: true } } },
    });
    return { session, refreshToken };
  }

  private successor(token: string): string {
    const id = token.startsWith('s1.') ? token.split('.')[1] : `legacy_${hashToken(token)}`;
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is required');
    return `s1.${id}.${createHmac('sha256', secret).update(`moodies:refresh:${token}`).digest('hex')}`;
  }

  private async importLegacy(token: string) {
    if (!/^[a-f0-9]{64}$/.test(token)) return;
    const hash = hashToken(token);
    const legacy = await this.redis.getSessionWithTtl(`rt:${hash}`) ??
      await this.redis.getSessionWithTtl(`rt:${token}`);
    if (!legacy) return;
    await this.prisma.$transaction(async (tx) => {
      // Match password-change lock order: a legacy import must not race revocation.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${legacy.value} FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: legacy.value }, select: { authVersion: true } });
      if (!user || user.authVersion !== 0) return;
      await tx.authSession.upsert({
        where: { id: `legacy_${hash}` },
        create: { id: `legacy_${hash}`, userId: legacy.value, tokenHash: hash, expiresAt: new Date(Date.now() + legacy.ttlSeconds * 1000) },
        update: {},
      });
    });
  }

  async rotate(token: string) {
    if (!token || token.length > 256) {
      this.logger.warn('refresh_cookie_missing_or_malformed');
      return null;
    }
    const hash = hashToken(token);
    try {
      const known = await this.prisma.authSession.findFirst({
        where: { OR: [{ tokenHash: hash }, { previousTokenHash: hash }] }, select: { id: true },
      });
      if (!known) await this.importLegacy(token);
      return await this.prisma.$transaction(async (tx) => {
        // Lock before reading the mutable hashes; concurrent requests see the committed successor.
        const rows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "auth_sessions"
          WHERE "tokenHash" = ${hash} OR "previousTokenHash" = ${hash} FOR UPDATE`;
        if (!rows.length) {
          this.logger.warn('session_unknown');
          return null;
        }
        const session = await tx.authSession.findUniqueOrThrow({
          where: { id: rows[0].id },
          include: { user: { select: { id: true, email: true, authVersion: true } } },
        });
        const now = new Date();
        if (session.revokedAt || session.expiresAt <= now) {
          this.logger.warn('session_expired_or_revoked');
          return null;
        }
        if (session.previousTokenHash === hash) {
          if (!session.previousValidUntil || session.previousValidUntil < now) {
            await tx.authSession.update({ where: { id: session.id }, data: { revokedAt: now } });
            this.logger.warn('refresh_token_reused');
            return null;
          }
          return { session, refreshToken: this.successor(token) };
        }
        // Do not advance again during the retry window: delayed responses must converge on one cookie.
        if (session.previousValidUntil && session.previousValidUntil >= now) {
          return { session, refreshToken: token };
        }
        const refreshToken = this.successor(token);
        const rotated = await tx.authSession.update({
          where: { id: session.id },
          data: { tokenHash: hashToken(refreshToken), previousTokenHash: hash, previousValidUntil: new Date(now.getTime() + REFRESH_RETRY_GRACE_MS) },
        });
        return { session: { ...rotated, user: session.user }, refreshToken };
      });
    } catch {
      this.logger.error('session_store_unavailable');
      throw new ServiceUnavailableException('Your session could not be checked. Please try again.');
    }
  }

  async revoke(token: string | undefined) {
    if (!token || token.length > 256) return;
    const hash = hashToken(token);
    await this.prisma.authSession.updateMany({
      where: { OR: [{ tokenHash: hash }, { previousTokenHash: hash }], revokedAt: null },
      data: { revokedAt: new Date() },
    });
    // Only legacy sessions depend on Redis. Failure must be reported, not a pretend logout.
    if (/^[a-f0-9]{64}$/.test(token)) await this.redis.deleteSessionKeys([`rt:${hash}`, `rt:${token}`]);
  }

  async isActive(identity: AccessIdentity): Promise<boolean> {
    if (!identity.sub) return false;
    const user = await this.prisma.user.findUnique({ where: { id: identity.sub }, select: { authVersion: true } });
    if (!user || user.authVersion !== (identity.ver ?? 0)) return false;
    if (!identity.sid) return true; // Existing access JWTs expire naturally during rollout.
    return !!await this.prisma.authSession.findFirst({
      where: { id: identity.sid, userId: identity.sub, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true },
    });
  }
}
