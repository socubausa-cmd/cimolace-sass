import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import type { Request } from 'express';
import { SupabaseService } from '../supabase/supabase.service';
import type { TenantContext } from '../tenant/tenant.types';

type ApiKeyRequest = Request & {
  tenant?: TenantContext;
  apiKeyId?: string;
  authViaApiKey?: boolean;
};

/**
 * Préfixes acceptés pour les clés API tenant. Le format complet est :
 *   {prefix}_{slug}_{random32}
 *
 * - `cml_` : clé Cimolace générique (tous engines)
 * - `mdk_` : clé spécifique MEDOS (medical key)
 */
const VALID_PREFIXES = ['cml_', 'mdk_'];

/**
 * Guard d'authentification par clé API tenant.
 *
 * Utilisé pour les appels server-to-server depuis un site client externe
 * (ex : backend ZahirWellness → API MEDOS). Pas de session, pas de cookie,
 * pas de JWT Supabase — uniquement Authorization: Bearer <clé brute>.
 *
 * Sécurité :
 *  - La clé brute n'est jamais stockée, seul son hash SHA-256
 *  - last_used_at est mis à jour à chaque appel (audit)
 *  - revoked_at coupe immédiatement la clé
 *  - tenant_id résolu depuis la clé → isolation multi-tenant garantie
 *
 * Le guard peuple :
 *  - req.tenant       → TenantContext (avec userRole = 'clinic_admin')
 *  - req.apiKeyId     → UUID de la clé utilisée (pour audit)
 *  - req.authViaApiKey → true (utile pour différencier des JWT)
 *
 * NOTE : les clés API agissent avec un role 'clinic_admin' par défaut,
 * suffisant pour CRUD patients/notes/forms mais pas pour les routes
 * réservées au rôle 'patient' (espace patient). Pour le mode patient-portal
 * embeddé, utiliser EmbedTokenGuard plutôt qu'ApiKeyGuard.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<ApiKeyRequest>();
    const auth = req.headers['authorization'];

    if (!auth || typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token requis');
    }

    const raw = auth.slice(7).trim();
    if (!VALID_PREFIXES.some((p) => raw.startsWith(p))) {
      throw new UnauthorizedException(
        'Format de clé API invalide (préfixe attendu: cml_ ou mdk_)',
      );
    }

    const hash = createHash('sha256').update(raw).digest('hex');

    const { data: key, error } = await (this.supabase.client as any)
      .from('tenant_api_keys')
      .select('id, tenant_id, revoked_at, label')
      .eq('key_hash', hash)
      .maybeSingle();

    if (error) {
      this.logger.error(`api_key lookup error: ${error.message}`);
      throw new UnauthorizedException('Clé API invalide');
    }

    if (!key) {
      throw new UnauthorizedException('Clé API inconnue');
    }

    if (key.revoked_at) {
      throw new UnauthorizedException('Clé API révoquée');
    }

    // Résoudre le tenant
    const { data: tenant, error: tErr } = await (this.supabase.client as any)
      .from('tenants')
      .select('*')
      .eq('id', key.tenant_id)
      .single();

    if (tErr || !tenant) {
      this.logger.error(
        `api_key tenant lookup failed for key ${key.id}: ${tErr?.message}`,
      );
      throw new UnauthorizedException('Tenant lié à la clé introuvable');
    }

    req.tenant = {
      ...(tenant as any),
      userRole: 'clinic_admin', // role par défaut pour les clés API server-to-server
    };
    req.apiKeyId = key.id;
    req.authViaApiKey = true;

    // Mise à jour last_used_at — fire and forget, ne doit pas bloquer
    void (this.supabase.client as any)
      .from('tenant_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', key.id)
      .then(
        () => null,
        (err: any) =>
          this.logger.warn(`last_used_at update failed: ${err?.message}`),
      );

    return true;
  }
}
