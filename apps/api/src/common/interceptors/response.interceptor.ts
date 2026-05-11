import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, Observable } from 'rxjs';
import { SKIP_RESPONSE_WRAPPER } from '../decorators/skip-response-wrapper.decorator';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_RESPONSE_WRAPPER,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (skip) return next.handle();
    return next.handle().pipe(map((data: unknown) => ({ data })));
  }
}
