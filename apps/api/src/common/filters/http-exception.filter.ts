import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Erreur interne du serveur';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (
        typeof body === 'object' &&
        body !== null &&
        'message' in body
      ) {
        const raw = body.message;
        message = Array.isArray(raw)
          ? (raw as string[]).join('; ')
          : String(raw);
      }
      code = HttpStatus[status] ?? 'HTTP_ERROR';
    } else {
      this.logger.error(exception);
    }

    res.status(status).json({ error: { code, message } });
  }
}
