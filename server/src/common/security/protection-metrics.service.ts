import { Injectable, Logger } from '@nestjs/common';

type Kind = 'captcha' | 'rate_limit';
type Outcome = 'allowed' | 'rejected' | 'unavailable';
type Summary = {
  allowed: number;
  rejected: number;
  unavailable: number;
  elapsedMs: number;
  maxMs: number;
  since: number;
};
const SUMMARY_INTERVAL_MS = 60_000;

/** Fixed-cardinality summaries for log ingestion; no identifiers or raw tokens. */
@Injectable()
export class ProtectionMetricsService {
  private readonly logger = new Logger(ProtectionMetricsService.name);
  private readonly summaries = new Map<Kind, Summary>();

  record(kind: Kind, outcome: Outcome, elapsedMs: number) {
    const now = Date.now();
    const summary = this.summaries.get(kind) ?? {
      allowed: 0,
      rejected: 0,
      unavailable: 0,
      elapsedMs: 0,
      maxMs: 0,
      since: now,
    };
    summary[outcome]++;
    summary.elapsedMs += Math.max(0, elapsedMs);
    summary.maxMs = Math.max(summary.maxMs, elapsedMs);
    if (now - summary.since >= SUMMARY_INTERVAL_MS) {
      const count = summary.allowed + summary.rejected + summary.unavailable;
      this.logger.log(
        JSON.stringify({
          event: 'protection_summary',
          kind,
          windowMs: now - summary.since,
          allowed: summary.allowed,
          rejected: summary.rejected,
          unavailable: summary.unavailable,
          averageMs: Math.round(summary.elapsedMs / count),
          maxMs: summary.maxMs,
        }),
      );
      this.summaries.delete(kind);
    } else this.summaries.set(kind, summary);
  }
}
