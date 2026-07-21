import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Least-privilege pour les endpoints d'ADMINISTRATION du catalogue mbolo
 * authentifiés par clé API (`/v1/mbolo/admin/*`).
 *
 * À placer APRÈS `ApiKeyGuard` (qui résout le tenant + pose `req.apiKeyIsAdmin`).
 * Seule une clé `mba_` (Mbolo Admin) peut écrire : une clé `mbk_` (storefront
 * public, potentiellement plus exposée) est refusée ici même si elle résout le
 * bon tenant. Ainsi une `mbk_` fuitée ne peut pas modifier le catalogue.
 */
@Injectable()
export class MboloAdminKeyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request & { apiKeyIsAdmin?: boolean }>();
    if (req.apiKeyIsAdmin !== true) {
      throw new ForbiddenException(
        "Clé d'administration Mbolo requise (préfixe mba_). Une clé storefront mbk_ est en lecture seule.",
      );
    }
    return true;
  }
}
