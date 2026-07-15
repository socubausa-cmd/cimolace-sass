import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthUser } from '../auth/current-user.decorator';
import { ALLOW_NON_MEMBER_KEY } from '../common/decorators/allow-non-member.decorator';
import type { TenantContext } from './tenant.types';
import { TenantService } from './tenant.service';

type TenantRequest = Request & { user: AuthUser; tenant: TenantContext };

const SLUG_PATTERN = /^[a-z0-9-]{1,64}$/;

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly tenantService: TenantService,
    private readonly reflector: Reflector,
  ) {}

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

    // Opt-out explicite (@AllowNonMember) : surfaces qui doivent servir un
    // authentifié non-membre (viewer live public, assistant IA invité). Le
    // contexte est résolu par slug sans exiger de membership (userRole peut
    // être null) — on préserve l'ancien comportement fail-open pour CES seules
    // routes, sans exposer de données sensibles.
    const allowNonMember =
      this.reflector.getAllAndOverride<boolean>(ALLOW_NON_MEMBER_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) === true;
    if (allowNonMember) {
      req.tenant = await this.tenantService.resolveTenantAllowNonMember(
        req.user.id,
        slug,
      );
      return true;
    }

    // FAIL-CLOSED : resolveForUser renvoie null si l'utilisateur n'est pas membre
    // actif du tenant → 403 (avant : `return true` inconditionnel = BOLA).
    req.tenant = await this.tenantService.resolveForUser(slug, req.user.id);
    if (!req.tenant) {
      throw new ForbiddenException('Accès tenant refusé');
    }
    return true;
  }
}
