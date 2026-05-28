import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { SupabaseService } from '../../supabase/supabase.service';

export type TenantApiKeyRow = {
  id: string;
  tenant_id: string;
  label: string;
  key_prefix: string;
  created_by: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type GeneratedApiKey = TenantApiKeyRow & {
  /** Valeur brute, retournée UNE SEULE FOIS à la création. Non récupérable ensuite. */
  raw_key: string;
};

const SLUG_PATTERN = /^[a-z0-9-]{1,32}$/;

@Injectable()
export class ApiKeysService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Génère une nouvelle clé API pour un tenant donné.
   * Format : `mdk_<tenant_slug>_<32 caractères aléatoires hex>`
   *
   * La valeur brute n'est retournée qu'à cet appel — on ne stocke que son
   * hash SHA-256. Si l'utilisateur perd la clé, il faut en générer une nouvelle.
   */
  async createKey(
    tenantId: string,
    tenantSlug: string,
    label: string,
    createdBy: string | null,
  ): Promise<GeneratedApiKey> {
    if (!label || label.trim().length < 3) {
      throw new BadRequestException(
        'Le label doit faire au moins 3 caractères',
      );
    }

    if (!SLUG_PATTERN.test(tenantSlug)) {
      throw new BadRequestException('Slug tenant invalide');
    }

    const random = randomBytes(24).toString('hex'); // 48 chars
    const rawKey = `mdk_${tenantSlug}_${random}`;
    const keyPrefix = `mdk_${tenantSlug}_${random.slice(0, 4)}…`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const { data, error } = await (this.supabase.client as any)
      .from('tenant_api_keys')
      .insert({
        tenant_id: tenantId,
        label: label.trim(),
        key_prefix: keyPrefix,
        key_hash: keyHash,
        created_by: createdBy,
      })
      .select('id, tenant_id, label, key_prefix, created_by, last_used_at, revoked_at, created_at')
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        `Création de la clé API impossible : ${error?.message ?? 'erreur inconnue'}`,
      );
    }

    return {
      ...(data as TenantApiKeyRow),
      raw_key: rawKey,
    };
  }

  /**
   * Liste toutes les clés d'un tenant. Aucune valeur brute n'est retournée
   * (impossible — seul le hash est stocké). Seul le préfixe sert d'identifiant
   * visuel pour l'opérateur.
   */
  async listKeys(tenantId: string): Promise<TenantApiKeyRow[]> {
    const { data, error } = await (this.supabase.client as any)
      .from('tenant_api_keys')
      .select(
        'id, tenant_id, label, key_prefix, created_by, last_used_at, revoked_at, created_at',
      )
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(
        `Lecture des clés impossible : ${error.message}`,
      );
    }

    return (data ?? []) as TenantApiKeyRow[];
  }

  /**
   * Révoque une clé (soft-delete via `revoked_at`). Une clé révoquée est
   * immédiatement refusée par l'ApiKeyGuard.
   */
  async revokeKey(tenantId: string, keyId: string): Promise<{ id: string }> {
    const { data, error } = await (this.supabase.client as any)
      .from('tenant_api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', keyId)
      .eq('tenant_id', tenantId)
      .is('revoked_at', null)
      .select('id')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        `Révocation impossible : ${error.message}`,
      );
    }
    if (!data) {
      throw new NotFoundException('Clé introuvable ou déjà révoquée');
    }

    return { id: (data as any).id };
  }
}
