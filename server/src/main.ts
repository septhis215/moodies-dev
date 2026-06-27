import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Don't advertise the framework. Reduces fingerprinting for targeted attacks.
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  // Baseline security headers. (For a production-grade set, swap this for the
  // `helmet` middleware; this dependency-free version covers the essentials for
  // a JSON API.)
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    next();
  });

  // CORS origins come from env so prod isn't pinned to localhost. Supports a
  // comma-separated allowlist (CORS_ORIGINS) and falls back to CLIENT_URL, then
  // the local dev origin.
  const allowedOrigins = (
    process.env.CORS_ORIGINS ??
    process.env.CLIENT_URL ??
    'http://localhost:3000'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const isAllowedVercelPreview = (origin: string): boolean =>
    /^https:\/\/moodies-dev(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(origin);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || isAllowedVercelPreview(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    // Cross-origin JSON mutations preflight in staging; cache successful OPTIONS
    // checks briefly so repeated save/like clicks do not pay that round trip.
    maxAge: 600,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // for automatic data type conversion, do not remove
      whitelist: true, // for stripping unknown properties, do not remove
    }),
  ); // to enable pipe validation globally, do not remove

  // Ensure unexpected (non-HTTP) errors never leak internals to clients.
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = process.env.PORT || 3001; // set PORT env or default
  await app.listen(port);
  Logger.log(`Nest listening on http://localhost:${port}`, 'Bootstrap');
}
bootstrap();
