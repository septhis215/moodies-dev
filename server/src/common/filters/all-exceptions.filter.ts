import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

/**
 * Global safety net for anything thrown outside an HttpException — most notably
 * Prisma errors and other library internals. Those carry table/column names,
 * query fragments and stack traces that must never reach a client. Http
 * exceptions are intentional and already client-safe, so we pass them through
 * unchanged; everything else collapses to an opaque 500 and is logged
 * server-side with enough detail to debug.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      // Log server-side 5xx so they are not silently swallowed.
      if (status >= 500) {
        this.logger.error(
          `${request?.method} ${request?.url} -> ${status}`,
          exception.stack,
        );
      }
      return response.status(status).json(exception.getResponse());
    }

    // Unknown error: log the real cause, return a generic message.
    this.logger.error(
      `Unhandled exception on ${request?.method} ${request?.url}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  }
}
