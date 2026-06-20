import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { SupabaseService } from '../../supabase/supabase.service';
import type { TenantContext } from '../../tenant/tenant.types';
import {
  CreateCatalogServiceDto,
  UpdateCatalogServiceDto,
} from './billing-catalog.dto';

type AnyObj = Record<string, any>;

/**
 * Vue camelCase d'un service du catalogue renvoyée au front.
 * Mappe 1:1 les colonnes pertinentes de `billing_plans`.
 */
export type CatalogService = {
  key: string;
  category: string | null;
  label: string | null;
  tagline: string | null;
  description: string | null;
  priceCents: number;
  currency: string | null;
  billingCycle: string | null;
  accessModel: string;
  isActive: boolean;
  sortOrder: number;
  features: any[] | null;
  metadata: Record<string, any> | null;
};

/** Colonnes sélectionnées partout (cohérence list/create/update). */
const SELECT_COLS =
  'key, category, label, tagline, description, price_cents, currency, billing_cycle, access_model, is_active, sort_order, features, metadata';

@Injectable()
export class BillingCatalogService {
  private readonly logger = new Logger(BillingCatalogService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /** Client Supabase service_role (non typé : on écrit des colonnes hors types générés). */
  private get sb(): AnyObj {
    return this.supabase.client as any;
  }

  /** Mappe une ligne DB `billing_plans` → vue camelCase. */
  private toCamel(row: AnyObj): CatalogService {
    return {
      key: row.key,
      category: row.category ?? null,
      label: row.label ?? null,
      tagline: row.tagline ?? null,
      description: row.description ?? null,
      priceCents: typeof row.price_cents === 'number' ? row.price_cents : 0,
      currency: row.currency ?? null,
      billingCycle: row.billing_cycle ?? null,
      accessModel: row.access_model ?? 'paid',
      isActive: !!row.is_active,
      sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
      features: (row.features as any[] | null) ?? null,
      metadata: (row.metadata as Record<string, any> | null) ?? null,
    };
  }

  /**
   * Slug ASCII minimal à partir d'un libellé (sans accents, tirets, lowercase).
   * Vide → 'service' (filet de sécurité pour ne jamais produire de clé nulle).
   */
  private slugify(input: string): string {
    const base = String(input ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // retire les diacritiques
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    return base || 'service';
  }

  /** Suffixe court aléatoire (6 hex) pour rendre une clé unique. */
  private shortSuffix(): string {
    return randomBytes(3).toString('hex');
  }

  // ─── GET : liste du catalogue du tenant (actifs ET inactifs) ───────────────

  async list(t: TenantContext): Promise<{ services: CatalogService[] }> {
    const { data, error } = await this.sb
      .from('billing_plans')
      .select(SELECT_COLS)
      .eq('tenant_id', t.id)
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('price_cents', { ascending: true });

    if (error) throw new BadRequestException(error.message);

    return { services: (data ?? []).map((r: AnyObj) => this.toCamel(r)) };
  }

  // ─── POST : création d'un service au catalogue du tenant ───────────────────

  async create(
    t: TenantContext,
    body: CreateCatalogServiceDto,
  ): Promise<CatalogService> {
    // Clé dérivée du label (slugify) + suffixe court unique. La colonne `key`
    // est globalement unique en DB : on scope visuellement par tenant via le
    // slug, et l'unicité dure est garantie par le suffixe aléatoire.
    const key = `${this.slugify(body.label)}-${this.shortSuffix()}`;

    const row: AnyObj = {
      tenant_id: t.id,
      key,
      category: body.category,
      label: body.label,
      tagline: body.tagline ?? null,
      description: body.description ?? null,
      price_cents: body.priceCents,
      currency: body.currency.toUpperCase(),
      billing_cycle: body.billingCycle,
      access_model: body.accessModel ?? 'paid',
      is_active: true,
      sort_order: body.sortOrder ?? 0,
      features: body.features ?? [],
      metadata: body.metadata ?? {},
    };

    const { data, error } = await this.sb
      .from('billing_plans')
      .insert(row)
      .select(SELECT_COLS)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new BadRequestException('Création sans résultat.');

    return this.toCamel(data);
  }

  // ─── PATCH : mise à jour (SCOPÉE par tenant_id) ────────────────────────────

  async update(
    t: TenantContext,
    key: string,
    body: UpdateCatalogServiceDto,
  ): Promise<CatalogService> {
    // On ne pousse que les champs réellement fournis (PATCH partiel).
    const patch: AnyObj = {};
    if (body.category !== undefined) patch.category = body.category;
    if (body.label !== undefined) patch.label = body.label;
    if (body.tagline !== undefined) patch.tagline = body.tagline;
    if (body.description !== undefined) patch.description = body.description;
    if (body.priceCents !== undefined) patch.price_cents = body.priceCents;
    if (body.currency !== undefined) patch.currency = body.currency.toUpperCase();
    if (body.billingCycle !== undefined) patch.billing_cycle = body.billingCycle;
    if (body.accessModel !== undefined) patch.access_model = body.accessModel;
    if (body.isActive !== undefined) patch.is_active = body.isActive;
    if (body.sortOrder !== undefined) patch.sort_order = body.sortOrder;
    if (body.features !== undefined) patch.features = body.features;
    if (body.metadata !== undefined) patch.metadata = body.metadata;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('Aucun champ à mettre à jour.');
    }

    // SCOPE OBLIGATOIRE : key + tenant_id → un owner ne touche JAMAIS le plan
    // d'un autre tenant (même si la clé existe ailleurs).
    const { data, error } = await this.sb
      .from('billing_plans')
      .update(patch)
      .eq('key', key)
      .eq('tenant_id', t.id)
      .select(SELECT_COLS)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data)
      throw new NotFoundException('Service introuvable pour ce tenant.');

    return this.toCamel(data);
  }

  // ─── DELETE : soft (is_active=false) ou hard (?hard=true) ──────────────────

  async remove(
    t: TenantContext,
    key: string,
    hard: boolean,
  ): Promise<{ ok: true; key: string; hard: boolean }> {
    if (hard) {
      // Suppression définitive, toujours scopée tenant_id.
      const { data, error } = await this.sb
        .from('billing_plans')
        .delete()
        .eq('key', key)
        .eq('tenant_id', t.id)
        .select('key')
        .maybeSingle();

      if (error) throw new BadRequestException(error.message);
      if (!data)
        throw new NotFoundException('Service introuvable pour ce tenant.');

      return { ok: true, key, hard: true };
    }

    // Soft delete : on désactive sans perdre la ligne.
    const { data, error } = await this.sb
      .from('billing_plans')
      .update({ is_active: false })
      .eq('key', key)
      .eq('tenant_id', t.id)
      .select('key')
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data)
      throw new NotFoundException('Service introuvable pour ce tenant.');

    return { ok: true, key, hard: false };
  }
}
