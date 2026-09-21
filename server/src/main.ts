import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Keep the public API namespace stable across local and hosted environments.
  app.setGlobalPrefix('api');

  // Don't advertise the framework. Reduces fingerprinting for targeted attacks.
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  // Baseline security headers. (For a production-grade set, swap this for the
  // `helmet` middleware; this dependency-free version covers the essentials for
  // a JSON API.)
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    // The client is a separately served Next app. CORS remains the access
    // control; CORP must allow the explicitly permitted client origin to read
    // JSON responses across the client/API origin boundary.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
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

  const isAllowedLocalDevelopmentOrigin = (origin: string): boolean => {
    if (process.env.NODE_ENV !== 'development') return false;

    try {
      const url = new URL(origin);
      const port = Number(url.port);
      return (
        (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
        url.protocol === 'http:' &&
        port >= 3000 &&
        port <= 3999
      );
    } catch {
      return false;
    }
  };

  app.enableCors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        isAllowedLocalDevelopmentOrigin(origin)
      ) {
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
