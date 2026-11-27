import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from './auth.types';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);
  constructor(private readonly prisma: PrismaService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<AuthenticatedRequest & Request>();
    const response = context.getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const routePath = request.route?.path;
    const path = `${request.baseUrl ?? ''}${typeof routePath === 'string' ? routePath : '/unmatched'}`.slice(0, 300);
    const suppliedRequestId = request.headers['x-request-id'];
    const requestId = typeof suppliedRequestId === 'string' && /^[A-Za-z0-9._:-]{1,80}$/.test(suppliedRequestId) ? suppliedRequestId : randomUUID();

    if (status >= 500) {
      const errorType = exception instanceof Error ? exception.constructor.name.slice(0, 120) : 'UnknownError';
      this.logger.error(`Unhandled API error ${requestId} ${request.method} ${path}`);
      void this.prisma.errorLog.create({ data: { requestId, method: request.method.slice(0, 10), path, statusCode: status, errorType, actorId: request.user?.sub ?? null } }).catch(() => {
        this.logger.warn(`Could not persist API error ${requestId}`);
      });
      response.status(status).json({ statusCode: status, message: 'Internal server error', requestId });
      return;
    }

    const body = exception instanceof HttpException ? exception.getResponse() : { statusCode: status, message: 'Request failed' };
    response.status(status).json(typeof body === 'string' ? { statusCode: status, message: body } : body);
  }
}
