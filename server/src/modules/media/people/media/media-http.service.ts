import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Bottleneck from 'bottleneck';

export class MediaProviderError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason?: string,
  ) {
    super(`Media provider returned ${status}${reason ? ` (${reason})` : ''}`);
  }
}
@Injectable()
export class MediaHttpService {
  private limiter = new Bottleneck({ maxConcurrent: 2, minTime: 150 });
  constructor(private readonly config: ConfigService) {}
  async json<T>(url: URL, headers: Record<string, string> = {}): Promise<T> {
    return this.limiter.schedule(async () => {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(6000),
        headers: {
          ...headers,
          accept: 'application/json',
          'User-Agent':
            this.config.get<string>('CELEBRITY_MEDIA_USER_AGENT') ||
            'Moodies/1.0 (moodies.support@gmail.com)',
        },
        redirect: 'error',
      });
      // Do not log the URL: the YouTube key is a query parameter.
      if (!response.ok) {
        let reason: string | undefined;
        if (url.hostname === 'www.googleapis.com') {
          const data = (await response.json().catch(() => null)) as {
            error?: { errors?: Array<{ reason?: string }> };
          } | null;
          const code = data?.error?.errors?.[0]?.reason;
          if (
            code &&
            [
              'quotaExceeded',
              'dailyLimitExceeded',
              'rateLimitExceeded',
              'keyInvalid',
              'accessNotConfigured',
              'ipRefererBlocked',
              'forbidden',
              'youtubeSignupRequired',
            ].includes(code)
          )
            reason = code;
        }
        throw new MediaProviderError(response.status, reason);
      }
      return (await response.json()) as T;
    });
  }
}
