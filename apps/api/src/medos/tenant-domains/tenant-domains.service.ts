import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

export type TenantDomainRow = {
  id: string;
  tenant_id: string;
  domain: string;
  usage: 'embed_origin' | 'custom_host';
  status: 'pending' | 'active' | 'revoked';
  verify_token: string | null;
  verified_at: string | null;
  ssl_status: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// FQDN simplifié — accepte aussi localhost et localhost:PORT pour dev
const DOMAIN_PATTERN =
  /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(:[0-9]{1,5})?$|^localhost(:[0-9]{1,5})?$/i;

@Injectable()
export class TenantDomainsService {
  constructor(private readonly supabase: SupabaseService) {}

  async add(
    tenantId: string,
    input: { domain: string; usage?: 'embed_origin' | 'custom_host' },
    createdBy: string | null,
  ): Promise<TenantDomainRow> {
    const domain = input.domain.trim().toLowerCase();
    const usage = input.usage ?? 'embed_origin';

    if (!DOMAIN_PATTERN.test(domain)) {
      throw new BadRequestException(
        `Domaine invalide : "${domain}". Attendu : fqdn sans protocole (ex: zahirwellness.com)`,
      );
    }

    if (usage !== 'embed_origin' && usage !== 'custom_host') {
      throw new BadRequestException('usage doit être embed_origin ou custom_host');
    }

    const { data, error } = await (this.supabase.client as any)
      .from('tenant_domains')
      .insert({
        tenant_id: tenantId,
        domain,
        usage,
        status: 'active', // embed_origin actif immédiatement ; custom_host activera après vérif DNS (S5)
        created_by: createdBy,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException(
          `Domaine "${domain}" déjà enregistré pour cet usage`,
        );
      }
      throw new InternalServerErrorException(
        `Ajout du domaine impossible : ${error.message}`,
      );
    }

    return data as TenantDomainRow;
  }

  async list(tenantId: string): Promise<TenantDomainRow[]> {
    const { data, error } = await (this.supabase.client as any)
      .from('tenant_domains')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(
        `Lecture des domaines impossible : ${error.message}`,
      );
    }

    return (data ?? []) as TenantDomainRow[];
  }

  async revoke(tenantId: string, domainId: string): Promise<{ id: string }> {
    const { data, error } = await (this.supabase.client as any)
      .from('tenant_domains')
      .update({ status: 'revoked' })
      .eq('id', domainId)
      .eq('tenant_id', tenantId)
      .neq('status', 'revoked')
      .select('id')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        `Révocation impossible : ${error.message}`,
      );
    }
    if (!data) {
      throw new NotFoundException('Domaine introuvable ou déjà révoqué');
    }

    return { id: (data as any).id };
  }
}
