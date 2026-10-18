import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { ClientIpService } from './client-ip.service';

const request = (peer: string, forwarded?: string, cloudflare?: string) =>
  ({
    socket: { remoteAddress: peer },
    headers: { 'x-forwarded-for': forwarded, 'cf-connecting-ip': cloudflare },
  }) as unknown as Request;
describe('trusted proxy client IP resolution', () => {
  const resolver = (settings = {}) =>
    new ClientIpService(new ConfigService(settings));
  it('ignores all forwarding headers without explicit proxy trust', () => {
    expect(
      resolver().get(request('192.0.2.1', '198.51.100.5', '198.51.100.7')),
    ).toBe('192.0.2.1');
  });
  it('never trusts a direct connection outside configured proxy networks', () => {
    expect(
      resolver({
        TRUST_PROXY: 'true',
        TRUSTED_PROXY_CIDRS: '127.0.0.1/32',
      }).get(request('192.0.2.1', '198.51.100.1')),
    ).toBe('192.0.2.1');
  });
  it('walks right-to-left and ignores attacker-prepended addresses', () => {
    const service = resolver({
      TRUST_PROXY: 'true',
      TRUSTED_PROXY_CIDRS: '127.0.0.1/32, 10.0.0.0/24',
    });
    expect(
      service.get(request('127.0.0.1', '203.0.113.99, 198.51.100.1, 10.0.0.5')),
    ).toBe('198.51.100.1');
  });
  it('normalizes IPv4-mapped socket addresses', () => {
    expect(
      resolver({
        TRUST_PROXY: 'true',
        TRUSTED_PROXY_CIDRS: '127.0.0.1/32',
      }).get(request('::ffff:127.0.0.1', '192.0.2.8')),
    ).toBe('192.0.2.8');
  });
  it('supports IPv6 proxy networks and canonicalizes addresses', () => {
    expect(
      resolver({
        TRUST_PROXY: 'true',
        TRUSTED_PROXY_CIDRS: '2001:db8:1::/64',
      }).get(request('2001:db8:1::1', '2001:0db8:2:0:0:0:0:2')),
    ).toBe('2001:db8:2::2');
  });
  it('uses the same identity for hex and dotted IPv4-mapped addresses', () => {
    expect(resolver().get(request('::ffff:c000:201'))).toBe('192.0.2.1');
    expect(resolver().get(request('::ffff:192.0.2.1'))).toBe('192.0.2.1');
  });
  it('rejects scoped addresses safely instead of throwing during URL parsing', () => {
    expect(resolver().get(request('fe80::1%eth0'))).toBe('unknown');
  });
  it('stops safely at malformed forwarding data', () => {
    expect(
      resolver({
        TRUST_PROXY: 'true',
        TRUSTED_PROXY_CIDRS: '127.0.0.1/32',
      }).get(request('127.0.0.1', '192.0.2.8, invalid')),
    ).toBe('127.0.0.1');
  });
  it.each([
    '',
    '0.0.0.0/0',
    '::/0',
    '127.0.0.1/nope',
    'bad',
    '127.0.0.1/33',
    '127.0.0.1/8/2',
  ])(
    'rejects unsafe or malformed trusted proxy configuration (%s)',
    (ranges) => {
      expect(() =>
        resolver({ TRUST_PROXY: 'true', TRUSTED_PROXY_CIDRS: ranges }),
      ).toThrow();
    },
  );
});
