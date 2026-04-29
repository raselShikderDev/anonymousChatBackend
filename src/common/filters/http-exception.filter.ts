import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (!(exception instanceof HttpException)) {
      console.error('[Unhandled]', exception);
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      });
    }

    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as any;

    // Services always throw structured { code, message } — pass through verbatim
    if (
      typeof exceptionResponse === 'object' &&
      typeof exceptionResponse.code === 'string' &&
      typeof exceptionResponse.message === 'string'
    ) {
      return response.status(status).json({
        success: false,
        error: {
          code: exceptionResponse.code,
          message: exceptionResponse.message,
        },
      });
    }

    // Fallback for NestJS built-in exceptions with no structured code
    let code: string;
    let message: string;

    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        code = 'UNAUTHORIZED';
        message = 'Missing or expired session token';
        break;
      case HttpStatus.FORBIDDEN:
        code = 'FORBIDDEN';
        message =
          typeof exceptionResponse === 'object'
            ? exceptionResponse.message ?? 'Forbidden'
            : String(exceptionResponse);
        break;
      case HttpStatus.NOT_FOUND:
        code = 'NOT_FOUND';
        message =
          typeof exceptionResponse === 'object'
            ? exceptionResponse.message ?? 'Not found'
            : String(exceptionResponse);
        console.warn(
          '[HttpExceptionFilter] Generic NOT_FOUND — missing structured code in service:',
          exceptionResponse,
        );
        break;
      case HttpStatus.CONFLICT:
        code = 'CONFLICT';
        message =
          typeof exceptionResponse === 'object'
            ? exceptionResponse.message ?? 'Conflict'
            : String(exceptionResponse);
        break;
      case HttpStatus.UNPROCESSABLE_ENTITY:
        code = 'UNPROCESSABLE_ENTITY';
        message =
          typeof exceptionResponse === 'object'
            ? exceptionResponse.message ?? 'Unprocessable entity'
            : String(exceptionResponse);
        break;
      case HttpStatus.BAD_REQUEST:
      default:
        code = 'VALIDATION_ERROR';
        if (typeof exceptionResponse === 'object') {
          message = Array.isArray(exceptionResponse.message)
            ? exceptionResponse.message[0]
            : exceptionResponse.message ?? 'Validation error';
        } else {
          message = String(exceptionResponse);
        }
        break;
    }

    return response.status(status).json({
      success: false,
      error: { code, message },
    });
  }
}