/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE TENANT SERVICE - SYSTÈME DE GESTION DES TENANTS
 * ═══════════════════════════════════════════════════════════════
 */

import { createClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════
// CLASS TENANT SERVICE
// ═══════════════════════════════════════════════════════════════

class TenantService {
  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Supabase URL or Anon Key not configured');
      this.supabase = null;
    } else {
      this.supabase = createClient(supabaseUrl, supabaseAnonKey);
    }

    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.cacheTimestamps = new Map();
  }

  /**
   * Récupère un tenant par son slug
   */
  async getTenantBySlug(slug) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return null;
    }

    // Vérifier le cache
    const slugKey = String(slug || '').trim().toLowerCase();
    if (!slugKey) {
      console.error('Tenant slug empty');
      return null;
    }

    if (this.isCacheValid(slugKey)) {
      return this.cache.get(slugKey);
    }

    try {
      const { data, error } = await this.supabase
        .from('cimolace_tenants')
        .select('*')
        .ilike('slug', slugKey)
        .maybeSingle();

      if (error || !data) {
        console.error(`Tenant not found: ${slug}`, error);
        return null;
      }

      const tenantConfig = this.mapToTenantConfig(data);

      this.cache.set(slugKey, tenantConfig);
      this.cacheTimestamps.set(slugKey, Date.now());

      return tenantConfig;
    } catch (error) {
      console.error(`Error fetching tenant: ${slug}`, error);
      return null;
    }
  }

  /**
   * Récupère un tenant par son ID
   */
  async getTenantById(id) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('cimolace_tenants')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        console.error(`Tenant not found: ${id}`, error);
        return null;
      }

      return this.mapToTenantConfig(data);
    } catch (error) {
      console.error(`Error fetching tenant: ${id}`, error);
      return null;
    }
  }

  /**
   * Vérifie si un tenant a une feature activée
   */
  async hasFeature(tenantSlug, feature) {
    const tenant = await this.getTenantBySlug(tenantSlug);
    
    if (!tenant) {
      return false;
    }

    return tenant.features[feature] || false;
  }

  /**
   * Récupère tous les tenants actifs
   */
  async getActiveTenants() {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from('cimolace_tenants')
        .select('*')
        .eq('status', 'active');

      if (error) {
        console.error('Error fetching tenants', error);
        return [];
      }

      return data.map(t => this.mapToTenantConfig(t));
    } catch (error) {
      console.error('Error fetching tenants', error);
      return [];
    }
  }

  /**
   * Crée un nouveau tenant
   */
  async createTenant(config) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return null;
    }

    try {
      const emailRow = String(config.metadata?.email || '').trim().toLowerCase();
      const meta = { ...(config.metadata || {}) };
      const br = { ...(meta.branding || {}) };
      if (emailRow && !br.vitrineContactEmail) br.vitrineContactEmail = emailRow;
      meta.branding = Object.keys(br).length ? br : meta.branding;

      const slugNorm = String(config.slug || meta.slug || '').trim().toLowerCase() || null;

      const { data, error } = await this.supabase
        .from('cimolace_tenants')
        .insert({
          name: config.name,
          slug: slugNorm,
          email: emailRow,
          status: 'active',
          metadata: meta,
        })
        .select('*')
        .single();

      if (error) {
        console.error('Error creating tenant', error);
        return null;
      }

      const tenantConfig = this.mapToTenantConfig(data);
      
      const cacheKey = tenantConfig.slug || config.slug;
      if (cacheKey) {
        this.cache.set(cacheKey, tenantConfig);
        this.cacheTimestamps.set(cacheKey, Date.now());
      }

      return tenantConfig;
    } catch (error) {
      console.error('Error creating tenant', error);
      return null;
    }
  }

  /**
   * Met à jour un tenant
   */
  async updateTenant(id, updates) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('cimolace_tenants')
        .update({
          name: updates.name,
          email: updates.metadata?.email,
          status: updates.status,
          metadata: updates.metadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.error('Error updating tenant', error);
        return null;
      }

      // Invalider le cache
      const tenant = await this.getTenantById(id);
      if (tenant?.slug) {
        this.cache.delete(tenant.slug);
        this.cacheTimestamps.delete(tenant.slug);
      }

      return this.mapToTenantConfig(data);
    } catch (error) {
      console.error('Error updating tenant', error);
      return null;
    }
  }

  /**
   * Supprime un tenant
   */
  async deleteTenant(id) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return false;
    }

    try {
      const tenantBefore = await this.getTenantById(id);

      const { error } = await this.supabase
        .from('cimolace_tenants')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting tenant', error);
        return false;
      }

      if (tenantBefore?.slug) {
        this.cache.delete(tenantBefore.slug);
        this.cacheTimestamps.delete(tenantBefore.slug);
      }

      return true;
    } catch (error) {
      console.error('Error deleting tenant', error);
      return false;
    }
  }

  /**
   * Vérifie si le cache est valide
   */
  isCacheValid(slug) {
    if (!this.cache.has(slug)) {
      return false;
    }

    const timestamp = this.cacheTimestamps.get(slug) || 0;
    const now = Date.now();
    
    return (now - timestamp) < this.cacheTimeout;
  }

  /**
   * Mappe les données Supabase vers TenantConfig
   */
  mapToTenantConfig(data) {
    const metadata = data.metadata || {};
    const rowEmail = typeof data.email === 'string' ? data.email.trim() : '';
    const defaultBranding = this.getDefaultBranding(data.name, rowEmail);
    const branding = { ...defaultBranding, ...(metadata.branding || {}) };
    if (!branding.vitrineContactEmail && rowEmail) {
      branding.vitrineContactEmail = rowEmail;
    }

    const slugVal = data.slug || metadata.slug || null;

    return {
      id: data.id,
      slug: slugVal ? String(slugVal).trim().toLowerCase() : null,
      name: data.name,
      status: data.status,
      features: metadata.features || this.getDefaultFeatures(),
      limits: metadata.limits || this.getDefaultLimits(),
      branding,
      content: metadata.content || this.getDefaultContent(),
      metadata: metadata,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Features par défaut
   */
  getDefaultFeatures() {
    return {
      school_engine: true,
      live_room: true,
      smartboard: true,
      creator_studio: true,
      admin_booking: true,
      marketing_creator: true,
      neuro_recall: true,
      replay_system: true,
    };
  }

  /**
   * Limits par défaut
   */
  getDefaultLimits() {
    return {
      maxStudents: 100,
      maxCourses: 10,
      maxLiveSessions: 50,
      storageGB: 10,
      maxTeachers: 5,
    };
  }

  /**
   * Branding par défaut
   */
  getDefaultBranding(name, contactEmail = '') {
    const e = typeof contactEmail === 'string' ? contactEmail.trim() : '';
    return {
      name: name,
      logo: '',
      primaryColor: '#000000',
      secondaryColor: '#666666',
      accentColor: '#0066cc',
      domain: '',
      /** Renseigné à la création du tenant (e-mail « infos » / contact hébergeur). */
      vitrineContactEmail: e || undefined,
    };
  }

  /**
   * Content par défaut
   */
  getDefaultContent() {
    return {
      messages: {},
      labels: {},
      descriptions: {},
    };
  }

  /**
   * Vide le cache
   */
  clearCache() {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }
}

// ═══════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════

let tenantServiceInstance = null;

export function getTenantService() {
  if (!tenantServiceInstance) {
    tenantServiceInstance = new TenantService();
  }
  return tenantServiceInstance;
}

export default TenantService;
