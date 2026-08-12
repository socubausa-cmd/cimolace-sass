import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { TenantContext } from '../tenant/tenant.types';

/**
 * Catalogue de services PAR TENANT (LIRI Service Engine, phase 1).
 *
 * L'API tourne en service_role et contourne donc RLS : le cloisonnement doit
 * être écrit ICI, explicitement. La RLS posée sur `services` est la seconde
 * barrière (accès direct depuis le front), pas la première.
 *
 * La table porte deux conventions de nommage — les colonnes historiques sont
 * en camelCase entre guillemets ("nameFr", "priceEUR"), les colonnes ajoutées
 * en phase 1 sont en snake_case. On ne renomme pas l'existant : ce serait du
 * bruit sans gain. Le mapper ci-dessous est le seul endroit qui connaît ce
 * détail ; l'API expose une forme unique.
 */
@Injectable()
export class ServiceEngineService {
  constructor(private readonly supabaseSvc: SupabaseService) {}

  private get db(): any {
    return this.supabaseSvc.client as any;
  }

  private static readonly COLS =
    'id, slug, "nameFr", "nameEn", "descriptionFr", "descriptionEn", "featuresFr", ' +
    '"priceEUR", price_xaf, tax_percent, "serviceType", "durationMinutes", "durationDays", ' +
    '"image", "icon", "gallery", "isActive", "sortOrder", "createdAt", "updatedAt", ' +
    'tenant_id, category_id, is_public, delivery_modes, liri_environment, is_group, capacity, ' +
    'prep_minutes, buffer_minutes, requires_booking, requires_payment, deposit_enabled, ' +
    'deposit_cents, deposit_percent, is_quote_only, cancellation_hours, refund_policy, terms, ' +
    'questionnaire, required_documents, travel_enabled, travel_fee_cents, travel_radius_km, ' +
    'min_notice_hours, max_advance_days';

  /** Forme publique unique, indépendante des deux conventions de la table. */
  private map(r: any) {
    return {
      id: r.id,
      slug: r.slug,
      name: r.nameFr,
      nameEn: r.nameEn ?? null,
      summary: r.descriptionFr ?? null,
      description: r.descriptionEn ?? null,
      features: r.featuresFr ?? [],
      categoryId: r.category_id ?? null,
      priceEur: r.priceEUR ?? 0,
      priceXaf: r.price_xaf ?? null,
      taxPercent: r.tax_percent ?? null,
      isQuoteOnly: !!r.is_quote_only,
      durationMinutes: r.durationMinutes ?? null,
      prepMinutes: r.prep_minutes ?? 0,
      bufferMinutes: r.buffer_minutes ?? 0,
      deliveryModes: r.delivery_modes ?? [],
      liriEnvironment: r.liri_environment ?? null,
      isGroup: !!r.is_group,
      capacity: r.capacity ?? null,
      requiresBooking: r.requires_booking !== false,
      requiresPayment: r.requires_payment !== false,
      depositEnabled: !!r.deposit_enabled,
      depositCents: r.deposit_cents ?? null,
      depositPercent: r.deposit_percent ?? null,
      cancellationHours: r.cancellation_hours ?? null,
      refundPolicy: r.refund_policy ?? null,
      terms: r.terms ?? null,
      questionnaire: r.questionnaire ?? [],
      requiredDocuments: r.required_documents ?? [],
      travelEnabled: !!r.travel_enabled,
      travelFeeCents: r.travel_fee_cents ?? null,
      travelRadiusKm: r.travel_radius_km ?? null,
      minNoticeHours: r.min_notice_hours ?? null,
      maxAdvanceDays: r.max_advance_days ?? null,
      image: r.image ?? null,
      icon: r.icon ?? null,
      isActive: r.isActive !== false,
      isPublic: !!r.is_public,
      sortOrder: r.sortOrder ?? 0,
      createdAt: r.createdAt ?? null,
      updatedAt: r.updatedAt ?? null,
    };
  }

  /** DTO → colonnes. Seules les clés FOURNIES sont écrites (patch partiel). */
  private toRow(dto: any): Record<string, unknown> {
    const row: Record<string, unknown> = {};
    const put = (col: string, v: unknown) => { if (v !== undefined) row[col] = v; };

    put('nameFr', dto.nameFr);
    put('nameEn', dto.nameEn);
    put('descriptionFr', dto.descriptionFr);
    put('descriptionEn', dto.fullDescription);
    put('category_id', dto.categoryId);
    put('delivery_modes', dto.deliveryModes);
    put('liri_environment', dto.liriEnvironment);
    put('priceEUR', dto.priceEur);
    put('price_xaf', dto.priceXaf);
    put('tax_percent', dto.taxPercent);
    put('is_quote_only', dto.isQuoteOnly);
    put('durationMinutes', dto.durationMinutes);
    put('prep_minutes', dto.prepMinutes);
    put('buffer_minutes', dto.bufferMinutes);
    put('is_group', dto.isGroup);
    put('capacity', dto.capacity);
    put('requires_booking', dto.requiresBooking);
    put('requires_payment', dto.requiresPayment);
    put('deposit_enabled', dto.depositEnabled);
    put('deposit_cents', dto.depositCents);
    put('deposit_percent', dto.depositPercent);
    put('cancellation_hours', dto.cancellationHours);
    put('refund_policy', dto.refundPolicy);
    put('terms', dto.terms);
    put('travel_enabled', dto.travelEnabled);
    put('travel_fee_cents', dto.travelFeeCents);
    put('travel_radius_km', dto.travelRadiusKm);
    put('min_notice_hours', dto.minNoticeHours);
    put('max_advance_days', dto.maxAdvanceDays);
    put('isActive', dto.isActive);
    put('is_public', dto.isPublic);
    put('sortOrder', dto.sortOrder);
    put('image', dto.image);
    put('questionnaire', dto.questionnaire);
    put('required_documents', dto.requiredDocuments);
    return row;
  }

  private slugify(s: string): string {
    return String(s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100) || 'service';
  }

  /** Slug libre POUR CE TENANT (l'unicité est par tenant depuis la phase 1). */
  private async freeSlug(tenantId: string, base: string, excludeId?: string): Promise<string> {
    const root = this.slugify(base);
    for (let i = 0; i < 50; i += 1) {
      const candidate = i === 0 ? root : `${root}-${i + 1}`;
      let q = this.db.from('services').select('id').eq('tenant_id', tenantId).eq('slug', candidate);
      if (excludeId) q = q.neq('id', excludeId);
      const { data } = await q.limit(1);
      if (!data?.length) return candidate;
    }
    return `${root}-${Date.now()}`;
  }

  // ── Services ──────────────────────────────────────────────────────────────

  async list(tenant: TenantContext, params: { categoryId?: string; includeInactive?: boolean }) {
    let q = this.db
      .from('services')
      .select(ServiceEngineService.COLS)
      .eq('tenant_id', tenant.id)
      .order('sortOrder', { ascending: true })
      .order('createdAt', { ascending: false });
    if (params.categoryId) q = q.eq('category_id', params.categoryId);
    if (!params.includeInactive) q = q.eq('isActive', true);

    const { data, error } = await q;
    if (error) throw new BadRequestException(error.message);
    return { services: (data || []).map((r: any) => this.map(r)) };
  }

  async get(tenant: TenantContext, id: string) {
    const { data } = await this.db
      .from('services').select(ServiceEngineService.COLS)
      .eq('id', id).eq('tenant_id', tenant.id).maybeSingle();
    if (!data) throw new NotFoundException('Service introuvable.');
    return this.map(data);
  }

  async create(tenant: TenantContext, userId: string, dto: any) {
    // Le DTO laisse `nameFr` facultatif pour que le PATCH partiel fonctionne ;
    // à la création il reste obligatoire, et la table l'impose de toute façon.
    // On préfère un 400 explicite à une erreur Postgres remontée telle quelle.
    if (!String(dto.nameFr || '').trim()) {
      throw new BadRequestException('Le nom du service est obligatoire.');
    }
    const row = this.toRow(dto);
    row.tenant_id = tenant.id;
    row.created_by = userId;
    row.slug = await this.freeSlug(tenant.id, dto.slug || dto.nameFr);
    // La table impose encore `updatedAt` NOT NULL ; le défaut existe mais on
    // reste explicite pour ne pas dépendre d'une valeur par défaut future.
    row.updatedAt = new Date().toISOString();

    const { data, error } = await this.db
      .from('services').insert(row).select(ServiceEngineService.COLS).single();
    if (error) throw new BadRequestException(error.message);
    return this.map(data);
  }

  async update(tenant: TenantContext, id: string, dto: any) {
    await this.get(tenant, id); // cloisonnement : 404 si le service n'est pas au tenant
    const row = this.toRow(dto);
    if (dto.slug) row.slug = await this.freeSlug(tenant.id, dto.slug, id);

    const { data, error } = await this.db
      .from('services').update(row)
      .eq('id', id).eq('tenant_id', tenant.id)
      .select(ServiceEngineService.COLS).single();
    if (error) throw new BadRequestException(error.message);
    return this.map(data);
  }

  /**
   * Archivage, pas suppression : un service peut être référencé par des
   * réservations passées. Le détruire arracherait l'historique du client.
   */
  async archive(tenant: TenantContext, id: string) {
    await this.get(tenant, id);
    const { error } = await this.db
      .from('services').update({ isActive: false, is_public: false })
      .eq('id', id).eq('tenant_id', tenant.id);
    if (error) throw new BadRequestException(error.message);
    return { status: 'archived' };
  }

  // ── Catégories ────────────────────────────────────────────────────────────

  async listCategories(tenant: TenantContext) {
    const { data, error } = await this.db
      .from('service_categories')
      .select('id, name, slug, description, parent_id, icon, sort_order, is_active')
      .eq('tenant_id', tenant.id)
      .order('sort_order', { ascending: true });
    if (error) throw new BadRequestException(error.message);

    // Compte des services par catégorie — évite un écran qui annonce des
    // catégories vides sans le dire.
    const { data: counts } = await this.db
      .from('services').select('category_id').eq('tenant_id', tenant.id).eq('isActive', true);
    const byCat = (counts || []).reduce((acc: Record<string, number>, s: any) => {
      if (s.category_id) acc[s.category_id] = (acc[s.category_id] || 0) + 1;
      return acc;
    }, {});

    return {
      categories: (data || []).map((c: any) => ({
        id: c.id, name: c.name, slug: c.slug, description: c.description,
        parentId: c.parent_id, icon: c.icon, sortOrder: c.sort_order,
        isActive: c.is_active, serviceCount: byCat[c.id] || 0,
      })),
    };
  }

  async createCategory(tenant: TenantContext, dto: any) {
    const slug = this.slugify(dto.slug || dto.name);
    const { data, error } = await this.db.from('service_categories').insert({
      tenant_id: tenant.id, name: dto.name, slug,
      description: dto.description ?? null, parent_id: dto.parentId ?? null,
      icon: dto.icon ?? null, sort_order: dto.sortOrder ?? 0,
      is_active: dto.isActive !== false,
    }).select('id, name, slug').single();
    if (error) {
      if (/duplicate|unique/i.test(error.message)) {
        throw new BadRequestException('Une catégorie porte déjà ce nom.');
      }
      throw new BadRequestException(error.message);
    }
    return data;
  }

  async updateCategory(tenant: TenantContext, id: string, dto: any) {
    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.slug !== undefined) patch.slug = this.slugify(dto.slug);
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.parentId !== undefined) patch.parent_id = dto.parentId;
    if (dto.icon !== undefined) patch.icon = dto.icon;
    if (dto.sortOrder !== undefined) patch.sort_order = dto.sortOrder;
    if (dto.isActive !== undefined) patch.is_active = dto.isActive;

    const { data, error } = await this.db
      .from('service_categories').update(patch)
      .eq('id', id).eq('tenant_id', tenant.id)
      .select('id, name, slug').maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Catégorie introuvable.');
    return data;
  }

  /** Les services rattachés sont détachés, jamais supprimés. */
  async deleteCategory(tenant: TenantContext, id: string) {
    const { data: existing } = await this.db
      .from('service_categories').select('id').eq('id', id).eq('tenant_id', tenant.id).maybeSingle();
    if (!existing) throw new NotFoundException('Catégorie introuvable.');

    await this.db.from('services').update({ category_id: null })
      .eq('category_id', id).eq('tenant_id', tenant.id);
    const { error } = await this.db
      .from('service_categories').delete().eq('id', id).eq('tenant_id', tenant.id);
    if (error) throw new BadRequestException(error.message);
    return { status: 'deleted' };
  }

  // ── Vitrine publique (§24, préparation) ───────────────────────────────────

  /** Uniquement ce que le tenant a explicitement publié. Aucune authentification. */
  async publicCatalog(tenantSlug: string) {
    const { data: tenant } = await this.db
      .from('tenants').select('id, slug, name, logo_url').eq('slug', tenantSlug).maybeSingle();
    if (!tenant) throw new NotFoundException('Espace introuvable.');

    const { data } = await this.db
      .from('services').select(ServiceEngineService.COLS)
      .eq('tenant_id', tenant.id).eq('is_public', true).eq('isActive', true)
      .order('sortOrder', { ascending: true });

    const { data: cats } = await this.db
      .from('service_categories').select('id, name, slug, icon, sort_order')
      .eq('tenant_id', tenant.id).eq('is_active', true)
      .order('sort_order', { ascending: true });

    return {
      space: { slug: tenant.slug, name: tenant.name, logoUrl: tenant.logo_url },
      categories: cats || [],
      services: (data || []).map((r: any) => this.map(r)),
    };
  }
}
