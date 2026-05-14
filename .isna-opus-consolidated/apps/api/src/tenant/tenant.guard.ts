import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../auth/current-user.decorator';
import type { TenantContext } from './tenant.types';
import { TenantService } from './tenant.service';

type TenantRequest = Request & { user: AuthUser; tenant: TenantContext };

const SLUG_PATTERN = /^[a-z0-9-]{1,64}$/;

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly tenantService: TenantService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<TenantRequest>();

    if (!req.user?.id) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }

    const slug = req.headers['x-tenant-slug'] as string | undefined;

    if (!slug) {
      throw new BadRequestException('Header X-Tenant-Slug manquant');
    }

    if (!SLUG_PATTERN.test(slug)) {
      throw new BadRequestException('Header X-Tenant-Slug invalide');
    }

    req.tenant = await this.tenantService.resolveForUser(slug, req.user.id);
    return true;
  }
}
