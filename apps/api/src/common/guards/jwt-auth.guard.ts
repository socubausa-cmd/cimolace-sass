import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../../auth/auth.service';

/**
 * Guard unifié — accepte deux types de tokens Bearer :
 *
 * 1. Token Supabase  → utilisateurs internes CIMOLACE (HS256/ES256, vérifié via auth.getUser)
 * 2. Token MedOS     → utilisateurs de tenants externes (HS256, iss=medos, vérifié localement)
 *
 * Dans les deux cas, req.user est normalisé à { id, email, role }.
 * Pour les tokens MedOS, req.user.tenant_id et req.user.tenant_slug sont aussi injectés
 * afin que le TenantGuard puisse être optionnellement contourné.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token manquant');
    }

    const token = authHeader.slice(7);

    // 1. Essai MedOS JWT (vérification locale, plus rapide)
    const medosPayload = this.authService.verifyMedosToken(token);
    if (medosPayload) {
      request.user = {
        id: medosPayload.sub,
        email: medosPayload.email,
        role: medosPayload.role,
        // Contexte tenant directement dans user pour les appels cross-tenant
        tenant_id: medosPayload.tenant_id,
        tenant_slug: medosPayload.tenant_slug,
        _source: 'medos',
        // Impersonation encadrée (§15) : rendre le contexte visible aux endpoints/audit/bannière.
        ...(medosPayload.imp
          ? { impersonation: { active: true, operator: medosPayload.impersonator ?? null, reason: medosPayload.imp_reason ?? null } }
          : {}),
      };
      return true;
    }

    // 2. Fallback Supabase (utilisateurs internes)
    const supabaseUser = await this.authService.verifyToken(token);
    if (supabaseUser) {
      request.user = { ...supabaseUser, _source: 'supabase' };
      return true;
    }

    throw new UnauthorizedException('Token invalide ou expiré');
  }
}
