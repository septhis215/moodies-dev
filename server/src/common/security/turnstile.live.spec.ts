import { ConfigService } from '@nestjs/config';
import { TurnstileService } from './turnstile.service';

// No application credentials or user data; explicit opt-in for the network call.
const suite =
  process.env.TURNSTILE_LIVE_TEST === 'true' ? describe : describe.skip;
suite('live Cloudflare dummy-key smoke check', () => {
  it('verifies the real provider protocol with public development credentials', async () => {
    const service = new TurnstileService(
      new ConfigService({
        NODE_ENV: 'development',
        TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
      }),
    );
    await expect(
      service.verifyToken('XXXX.DUMMY.TOKEN.XXXX', undefined, 'signup'),
    ).resolves.toBe(true);
  }, 15000);
});
