/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE SITE ENGINE
 * Moteur de gestion des sites clients
 * ═══════════════════════════════════════════════════════════════
 */

import { supabase } from '@/lib/supabase';
import { SiteStatus, SiteType, SitePlan, SiteEnvironment } from './siteTypes.js';

/**
 * SiteEngine - Moteur de gestion des sites
 */
export class SiteEngine {
  /**
   * Créer un nouveau site
   */
  async createSite(siteData) {
    const { data, error } = await supabase
      .from('cimolace_sites')
      .insert({
        tenant_id: siteData.tenant_id,
        name: siteData.name,
        domain: siteData.domain || null,
        subdomain: siteData.subdomain || null,
        plan: siteData.plan || SitePlan.STARTER,
        status: siteData.status || SiteStatus.PENDING,
        environment: siteData.environment || SiteEnvironment.PRODUCTION,
        metadata: siteData.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer un site par ID
   */
  async getSiteById(siteId) {
    const { data, error } = await supabase
      .from('cimolace_sites')
      .select(`
        *,
        cimolace_tenants (
          id,
          name,
          email
        )
      `)
      .eq('id', siteId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les sites d'un tenant
   */
  async getSitesByTenant(tenantId) {
    const { data, error } = await supabase
      .from('cimolace_sites')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer tous les sites avec filtres
   */
  async getAllSites(filters = {}) {
    let query = supabase.from('cimolace_sites').select(`
      *,
      cimolace_tenants (
        id,
        name,
        email
      )
    `);

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.plan) {
      query = query.eq('plan', filters.plan);
    }

    if (filters.environment) {
      query = query.eq('environment', filters.environment);
    }

    if (filters.tenant_id) {
      query = query.eq('tenant_id', filters.tenant_id);
    }

    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,domain.ilike.%${filters.search}%`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Mettre à jour un site
   */
  async updateSite(siteId, updates) {
    const { data, error } = await supabase
      .from('cimolace_sites')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', siteId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Suspendre un site
   */
  async suspendSite(siteId, reason) {
    return this.updateSite(siteId, {
      status: SiteStatus.SUSPENDED,
      metadata: { suspension_reason: reason },
    });
  }

  /**
   * Activer un site
   */
  async activateSite(siteId) {
    return this.updateSite(siteId, {
      status: SiteStatus.ACTIVE,
    });
  }

  /**
   * Supprimer un site
   */
  async deleteSite(siteId) {
    const { error } = await supabase
      .from('cimolace_sites')
      .delete()
      .eq('id', siteId);

    if (error) throw error;
  }

  /**
   * Récupérer les services activés d'un site
   */
  async getSiteServices(siteId) {
    const { data, error } = await supabase
      .from('cimolace_services')
      .select('*')
      .eq('site_id', siteId)
      .eq('status', 'active');

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les credentials d'un site
   */
  async getSiteCredentials(siteId) {
    const { data, error } = await supabase
      .from('cimolace_credentials')
      .select('id, key_name, key_type, description, last_rotated_at, expires_at, created_at, updated_at')
      .eq('site_id', siteId);

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer la configuration d'un site
   */
  async getSiteConfiguration(siteId) {
    const { data, error } = await supabase
      .from('cimolace_configuration_steps')
      .select('*')
      .eq('site_id', siteId)
      .order('step_number', { ascending: true });

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer la consommation d'un site
   */
  async getSiteUsage(siteId, periodStart, periodEnd) {
    const { data, error } = await supabase
      .from('cimolace_usage_logs')
      .select('*')
      .eq('site_id', siteId)
      .gte('period_start', periodStart)
      .lte('period_end', periodEnd)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les déploiements d'un site
   */
  async getSiteDeployments(siteId) {
    const { data, error } = await supabase
      .from('cimolace_deployments')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer la vue d'ensemble des sites
   */
  async getSitesOverview() {
    const { data, error } = await supabase
      .from('cimolace_sites_overview')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Liste des tenants techniques (hébergeur) pour rattacher un site.
   */
  async getAllTenants() {
    const { data, error } = await supabase
      .from('cimolace_tenants')
      .select('id, name, email, phone, status')
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Crée un tenant technique minimal (site besoin d’un tenant_id).
   */
  async createTenant(tenantData) {
    const emailNorm = tenantData.email.trim().toLowerCase();
    const baseMeta = tenantData.metadata || {};
    const baseBranding = baseMeta.branding || {};
    const metadata = {
      ...baseMeta,
      branding: {
        ...baseBranding,
        vitrineContactEmail: baseBranding.vitrineContactEmail || emailNorm,
      },
    };
    const { data, error } = await supabase
      .from('cimolace_tenants')
      .insert({
        name: tenantData.name,
        email: emailNorm,
        phone: tenantData.phone || null,
        status: tenantData.status || 'active',
        metadata,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

// Export singleton instance
export const siteEngine = new SiteEngine();
