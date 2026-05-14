import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { AuthService } from '../auth/auth.service';

export interface ApiKeyValidationResult {
  tenantId: string;
  tenantSlug: string;
  keyId: string;
}

@Injectable()
export class TenantApiKeyService {
  constructor(private readonly authService: AuthService) {}

  /** Génère une nouvelle clé API pour un tenant. Retourne la clé brute UNE SEULE FOIS. */
  async createKey(tenantId: string, label: string, createdBy: string) {
    const supabase = this.authService.getClient();

    const rawKey = `mdk_${randomBytes(32).toString('hex')}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.slice(0, 12); // ex: "mdk_a1b2c3d4e5"

    const { data, error } = await supabase
      .from('tenant_api_keys')
      .insert({ tenant_id: tenantId, label, key_prefix: keyPrefix, key_hash: keyHash, created_by: createdBy })
      .select('id, label, key_prefix, created_at')
      .single();

    if (error) throw new Error(error.message);
    return { ...data, key: rawKey }; // clé brute retournée une seule fois
  }

  /** Valide une clé API brute. Met à jour last_used_at. */
  async validateKey(rawKey: string): Promise<ApiKeyValidationResult | null> {
    const supabase = this.authService.getClient();
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const { data } = await supabase
      .from('tenant_api_keys')
      .select('id, tenant_id, revoked_at, tenants(slug)')
      .eq('key_hash', keyHash)
      .single();

    if (!data || data.revoked_at) return null;

    // Mise à jour non bloquante
    void supabase
      .from('tenant_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', data.id);

    return {
      tenantId: data.tenant_id,
      tenantSlug: (data.tenants as any)?.slug ?? '',
      keyId: data.id,
    };
  }

  /** Liste les clés actives d'un tenant (sans les hash). */
  async listKeys(tenantId: string) {
    const supabase = this.authService.getClient();
    const { data } = await supabase
      .from('tenant_api_keys')
      .select('id, label, key_prefix, last_used_at, created_at')
      .eq('tenant_id', tenantId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false });

    return data ?? [];
  }

  /** Révoque une clé (soft delete). */
  async revokeKey(keyId: string, tenantId: string) {
    const supabase = this.authService.getClient();
    const { data, error } = await supabase
      .from('tenant_api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', keyId)
      .eq('tenant_id', tenantId)
      .select('id')
      .single();

    if (error || !data) throw new NotFoundException('Clé introuvable ou déjà révoquée');
    return { revoked: true };
  }
}
