/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE SERVICE ENGINE
 * Moteur de gestion des services
 * ═══════════════════════════════════════════════════════════════
 */

import { supabase } from '@/lib/supabase';
import { ServiceStatus } from './serviceTypes.js';

/**
 * ServiceEngine - Moteur de gestion des services
 */
export class ServiceEngine {
  /**
   * Activer un service pour un site
   */
  async activateService(siteId, serviceKey, config = {}) {
    const { data, error } = await supabase
      .from('cimolace_services')
      .upsert({
        site_id: siteId,
        service_key: serviceKey,
        status: ServiceStatus.ACTIVE,
        config: config,
        activated_at: new Date().toISOString(),
        deactivated_at: null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Désactiver un service pour un site
   */
  async deactivateService(siteId, serviceKey) {
    const { data, error } = await supabase
      .from('cimolace_services')
      .update({
        status: ServiceStatus.INACTIVE,
        deactivated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('site_id', siteId)
      .eq('service_key', serviceKey)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les services d'un site
   */
  async getSiteServices(siteId) {
    const { data, error } = await supabase
      .from('cimolace_services')
      .select('*')
      .eq('site_id', siteId)
      .order('service_key', { ascending: true });

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les services actifs d'un site
   */
  async getActiveSiteServices(siteId) {
    const { data, error } = await supabase
      .from('cimolace_services')
      .select('*')
      .eq('site_id', siteId)
      .eq('status', ServiceStatus.ACTIVE)
      .order('service_key', { ascending: true });

    if (error) throw error;
    return data;
  }

  /**
   * Mettre à jour le quota d'un service
   */
  async updateServiceQuota(siteId, serviceKey, quotaLimit) {
    const { data, error } = await supabase
      .from('cimolace_services')
      .update({
        quota_limit: quotaLimit,
        updated_at: new Date().toISOString(),
      })
      .eq('site_id', siteId)
      .eq('service_key', serviceKey)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Mettre à jour l'utilisation d'un service
   */
  async updateServiceUsage(siteId, serviceKey, quotaUsed) {
    const { data, error } = await supabase
      .from('cimolace_services')
      .update({
        quota_used: quotaUsed,
        updated_at: new Date().toISOString(),
      })
      .eq('site_id', siteId)
      .eq('service_key', serviceKey)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer l'utilisation d'un service sur une période
   */
  async getServiceUsage(siteId, serviceKey, periodStart, periodEnd) {
    const { data, error } = await supabase
      .from('cimolace_usage_logs')
      .select('*')
      .eq('site_id', siteId)
      .eq('service', serviceKey)
      .gte('period_start', periodStart)
      .lte('period_end', periodEnd)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer tous les services disponibles
   */
  async getAllServices() {
    const { data, error } = await supabase
      .from('cimolace_services')
      .select(`
        *,
        cimolace_sites (
          id,
          name,
          domain
        )
      `)
      .order('site_id', { ascending: true })
      .order('service_key', { ascending: true });

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les sites utilisant un service spécifique
   */
  async getSitesUsingService(serviceKey) {
    const { data, error } = await supabase
      .from('cimolace_services')
      .select(`
        *,
        cimolace_sites (
          id,
          name,
          domain,
          cimolace_tenants (
            id,
            name,
            email
          )
        )
      `)
      .eq('service_key', serviceKey)
      .eq('status', ServiceStatus.ACTIVE);

    if (error) throw error;
    return data;
  }

  /**
   * Suspendre un service
   */
  async suspendService(siteId, serviceKey) {
    const { data, error } = await supabase
      .from('cimolace_services')
      .update({
        status: ServiceStatus.SUSPENDED,
        updated_at: new Date().toISOString(),
      })
      .eq('site_id', siteId)
      .eq('service_key', serviceKey)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Réactiver un service
   */
  async reactivateService(siteId, serviceKey) {
    const { data, error } = await supabase
      .from('cimolace_services')
      .update({
        status: ServiceStatus.ACTIVE,
        updated_at: new Date().toISOString(),
      })
      .eq('site_id', siteId)
      .eq('service_key', serviceKey)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

// Export singleton instance
export const serviceEngine = new ServiceEngine();
