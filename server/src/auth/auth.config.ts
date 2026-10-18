import ms, { type StringValue } from 'ms';

/** Read at request time: ConfigModule loads env files after module imports. */
export function accessTtlMs(): number {
  const value = process.env.JWT_ACCESS_EXPIRES || '15m';
  const ttl = /^\d+$/.test(value) ? Number(value) : ms(value as StringValue);
  if (!Number.isFinite(ttl) || ttl < 1000) {
    throw new Error('JWT_ACCESS_EXPIRES must be a duration of at least one second');
  }
  return Math.floor(ttl / 1000) * 1000;
}

export function refreshTtlMs(): number {
  const days = Number(process.env.REFRESH_EXPIRES_DAYS || 30);
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error('REFRESH_EXPIRES_DAYS must be positive');
  }
  return days * 24 * 60 * 60 * 1000;
}

// Allows concurrent tabs and a retry after a lost refresh response to converge.
export const REFRESH_RETRY_GRACE_MS = 30_000;
