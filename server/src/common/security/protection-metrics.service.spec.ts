import { Logger } from '@nestjs/common';
import { ProtectionMetricsService } from './protection-metrics.service';

describe('protection telemetry', () => {
  afterEach(() => jest.restoreAllMocks());
  it('emits bounded aggregate summaries rather than per-request logs', () => {
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const now = jest.spyOn(Date, 'now').mockReturnValue(0);
    const metrics = new ProtectionMetricsService();
    for (let index = 0; index < 100; index++)
      metrics.record('captcha', 'allowed', 20);
    expect(log).not.toHaveBeenCalled();
    now.mockReturnValue(60_001);
    metrics.record('captcha', 'rejected', 30);
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({
      event: 'protection_summary',
      allowed: 100,
      rejected: 1,
      unavailable: 0,
      maxMs: 30,
    });
  });
});
