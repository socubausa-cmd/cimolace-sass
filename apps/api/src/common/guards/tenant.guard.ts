import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_NON_MEMBER_KEY } from '../decorators/allow-non-member.decorator';
import { TenantService } from '../../tenant/tenant.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly tenantService: TenantService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.id;
    if (!userId) throw new ForbiddenException('Utilisateur non authentifié');

    // Tokens MedOS (tenants externes) portent déjà le contexte tenant —
    // on n'a pas besoin d'aller vérifier en base.
    if (request.user?._source === 'medos' && request.user.tenant_id) {
      request.tenant = {
        id: request.user.tenant_id,
        slug: request.user.tenant_slug,
        userRole: request.user.role,
      };
      return true;
    }

    // Tokens Supabase (utilisateurs internes) : résolution normale via DB.
    const slug = (request.headers['x-tenant-slug'] as string) ?? undefined;

    // Opt-out explicite (@AllowNonMember) : résout par slug sans exiger de
    // membership (viewer live public mbolo…). Le tenant doit tout de même
    // exister (403 sinon).
    const allowNonMember =
      this.reflector.getAllAndOverride<boolean>(ALLOW_NON_MEMBER_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true;
    const tenant = allowNonMember
      ? await this.tenantService.resolveTenantAllowNonMember(userId, slug)
      : await this.tenantService.resolveTenant(userId, slug);
    if (!tenant) throw new ForbiddenException('Accès tenant refusé');
    request.tenant = tenant;
    return true;
  }
}
