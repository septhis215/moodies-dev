import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlockList, isIP } from 'node:net';
import type { Request } from 'express';

/** Resolve from the socket inward. Headers alone never establish proxy trust. */
@Injectable()
export class ClientIpService {
  private readonly proxies = new BlockList();
  private readonly trustProxy: boolean;

  constructor(config: ConfigService) {
    this.trustProxy = config.get<string>('TRUST_PROXY') === 'true';
    const ranges = (config.get<string>('TRUSTED_PROXY_CIDRS') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (this.trustProxy && ranges.length === 0)
      throw new Error(
        'TRUST_PROXY=true requires TRUSTED_PROXY_CIDRS for the actual proxy network',
      );
    for (const range of ranges) {
      const [address, prefix, extra] = range.split('/');
      const version = isIP(address);
      const bits = version === 4 ? 32 : 128;
      const length = prefix === undefined ? bits : Number(prefix);
      if (
        !version ||
        extra !== undefined ||
        !Number.isInteger(length) ||
        length < 1 ||
        length > bits
      )
        throw new Error(
          'Invalid TRUSTED_PROXY_CIDRS entry (unrestricted networks are not allowed)',
        );
      this.proxies.addSubnet(address, length, version === 4 ? 'ipv4' : 'ipv6');
    }
  }

  get(req: Pick<Request, 'headers' | 'socket'>): string {
    let current = this.normalize(req.socket?.remoteAddress ?? '') || 'unknown';
    if (!this.trustProxy || !this.isTrusted(current)) return current;
    const header = req.headers['x-forwarded-for'];
    if (typeof header !== 'string' || header.length > 2048) return current;
    const chain = header.split(',');
    if (chain.length > 16) return current;
    for (
      let index = chain.length - 1;
      index >= 0 && this.isTrusted(current);
      index--
    ) {
      const next = this.normalize(chain[index].trim());
      if (!next) break;
      current = next;
    }
    return current;
  }

  private normalize(address: string): string {
    if (address.includes('%')) return '';
    if (!isIP(address)) return '';
    if (
      address.toLowerCase().startsWith('::ffff:') &&
      isIP(address.slice(7)) === 4
    )
      return address.slice(7);
    if (isIP(address) !== 6) return address;
    const canonical = new URL(`http://[${address}]/`).hostname.slice(1, -1);
    if (canonical.startsWith('::ffff:')) {
      const pieces = canonical.slice(7).split(':');
      if (pieces.length === 2) {
        const high = parseInt(pieces[0], 16),
          low = parseInt(pieces[1], 16);
        return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
      }
    }
    return canonical;
  }

  private isTrusted(address: string): boolean {
    const version = isIP(address);
    return (
      !!version && this.proxies.check(address, version === 4 ? 'ipv4' : 'ipv6')
    );
  }
}
