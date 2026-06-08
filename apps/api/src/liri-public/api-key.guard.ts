/**
 * ApiKeyGuard — Valide le header X-Liri-Api-Key contre tenant_api_keys.
 *
 * Format attendu : X-Liri-Api-Key: lk_live_<random>
 * La clé brute est hachée en SHA-256 et comparée à key_hash.
 * Met req.tenant + req.tenantApiKeyId sur la requête.
 */

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const rawKey =
      (req.headers['x-liri-api-key'] as string | undefined) ?? '';

    if (!rawKey || !rawKey.startsWith('lk_')) {
      throw new UnauthorizedException(
        'Header X-Liri-Api-Key manquant ou invalide. ' +
          'Format attendu : lk_live_xxxxx',
      );
    }

    const hash = createHash('sha256').update(rawKey).digest('hex');

    const { data: keyRow, error } = await (this.supabase.client as any)
      .from('tenant_api_keys')
      .select('id, tenant_id, revoked_at, tenants(id, slug, name, status)')
      .eq('key_hash', hash)
      .is('revoked_at', null)
      .maybeSingle();

    if (error || !keyRow) {
      throw new UnauthorizedException('Clé API invalide ou révoquée');
    }

    const tenant = (keyRow as any).tenants;
    if ((tenant as any)?.status !== 'active') {
      throw new UnauthorizedException('Tenant inactif');
    }

    // Met à jour last_used_at de façon non-bloquante
    (this.supabase.client as any)
      .from('tenant_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', (keyRow as any).id)
      .then(() => {});

    req.tenant = tenant;
    req.tenantApiKeyId = (keyRow as any).id;

    return true;
  }
}
