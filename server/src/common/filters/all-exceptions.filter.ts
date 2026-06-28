import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

type ErrorBody = {
  success: false;
  code: string;
  message: string;
  statusCode: number;
  timestamp: string;
  path: string;
  details?: {
    fieldErrors?: Record<string, string[]>;
  };
};

const STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

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

    const path = request?.url ?? '';
    const timestamp = new Date().toISOString();

    if (exception instanceof PrismaClientKnownRequestError) {
      const body = this.formatPrismaException(exception, path, timestamp);
      this.logger.warn(`${request?.method} ${path} -> ${body.statusCode} ${body.code}`);
      return response.status(body.statusCode).json(body);
    }

    if (exception instanceof HttpException) {
      const body = this.formatHttpException(exception, path, timestamp);
      if (body.statusCode >= 500) {
        this.logger.error(
          `${request?.method} ${path} -> ${body.statusCode}`,
          exception.stack,
        );
      }
      return response.status(body.statusCode).json(body);
    }

    // Unknown error: log the real cause, return a generic message.
    this.logger.error(
      `Unhandled exception on ${request?.method} ${path}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    return response.status(STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      code: 'SERVER_INTERNAL',
      statusCode: STATUS.INTERNAL_SERVER_ERROR,
      message: 'Something went wrong on our side. Please try again later.',
      timestamp,
      path,
    });
  }

  private formatHttpException(
    exception: HttpException,
    path: string,
    timestamp: string,
  ): ErrorBody {
    const statusCode = exception.getStatus();
    const response = exception.getResponse();
    const payload =
      response && typeof response === 'object'
        ? (response as Record<string, unknown>)
        : { message: response };
    const rawMessage = payload.message;
    const messages = Array.isArray(rawMessage)
      ? rawMessage.filter((message): message is string => typeof message === 'string')
      : typeof rawMessage === 'string'
        ? [rawMessage]
        : [];
    const code = this.codeForStatus(statusCode, payload.error);
    const fieldErrors =
      statusCode === STATUS.BAD_REQUEST && messages.length > 1
        ? { form: messages }
        : undefined;

    return {
      success: false,
      code,
      statusCode,
      message:
        messages[0] ??
        this.safeMessageForStatus(statusCode),
      timestamp,
      path,
      ...(fieldErrors ? { details: { fieldErrors } } : {}),
    };
  }

  private formatPrismaException(
    exception: PrismaClientKnownRequestError,
    path: string,
    timestamp: string,
  ): ErrorBody {
    if (exception.code === 'P2002') {
      return {
        success: false,
        code: 'DB_UNIQUE_CONSTRAINT',
        statusCode: STATUS.CONFLICT,
        message: 'That value is already in use.',
        timestamp,
        path,
      };
    }

    if (exception.code === 'P2025') {
      return {
        success: false,
        code: 'DB_RECORD_NOT_FOUND',
        statusCode: STATUS.NOT_FOUND,
        message: 'We could not find what you were looking for.',
        timestamp,
        path,
      };
    }

    return {
      success: false,
      code: 'DB_ERROR',
      statusCode: STATUS.INTERNAL_SERVER_ERROR,
      message: 'Something went wrong on our side. Please try again later.',
      timestamp,
      path,
    };
  }

  private codeForStatus(statusCode: number, error?: unknown): string {
    if (typeof error === 'string' && error.trim()) {
      return error.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    }

    switch (statusCode) {
      case STATUS.BAD_REQUEST:
        return 'VALIDATION_ERROR';
      case STATUS.UNAUTHORIZED:
        return 'AUTH_UNAUTHORIZED';
      case STATUS.FORBIDDEN:
        return 'AUTH_FORBIDDEN';
      case STATUS.NOT_FOUND:
        return 'NOT_FOUND';
      case STATUS.CONFLICT:
        return 'CONFLICT';
      case STATUS.TOO_MANY_REQUESTS:
        return 'RATE_LIMITED';
      default:
        return statusCode >= 500 ? 'SERVER_ERROR' : `HTTP_${statusCode}`;
    }
  }

  private safeMessageForStatus(statusCode: number): string {
    switch (statusCode) {
      case STATUS.UNAUTHORIZED:
        return 'Please log in again to continue.';
      case STATUS.FORBIDDEN:
        return 'You do not have permission to do this.';
      case STATUS.NOT_FOUND:
        return 'We could not find what you were looking for.';
      case STATUS.TOO_MANY_REQUESTS:
        return 'Too many requests. Please wait a moment and try again.';
      default:
        return statusCode >= 500
          ? 'Something went wrong on our side. Please try again later.'
          : 'Please check your request and try again.';
    }
  }
}
