import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { TenantContext } from '../../tenant/tenant.types';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { TenantRole } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<TenantRole[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required?.length) return true;

    const req = ctx.switchToHttp().getRequest<{ tenant: TenantContext }>();
    const userRole = req.tenant?.userRole;

    if (!userRole || !required.includes(userRole)) {
      throw new ForbiddenException(
        `Rôle requis : ${required.join(' | ')} — rôle actuel : ${userRole ?? 'inconnu'}`,
      );
    }
    return true;
  }
}
