/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE USAGE ENGINE
 * Moteur de gestion de la consommation
 * ═══════════════════════════════════════════════════════════════
 */

import { supabase } from '@/lib/supabase';

/**
 * UsageEngine - Moteur de gestion de la consommation
 */
export class UsageEngine {
  /**
   * Enregistrer une consommation
   */
  async logUsage(usageData) {
    const { data, error } = await supabase
      .from('cimolace_usage_logs')
      .insert({
        site_id: usageData.site_id,
        service: usageData.service,
        metric: usageData.metric,
        quantity: usageData.quantity,
        unit: usageData.unit || 'count',
        period_start: usageData.period_start,
        period_end: usageData.period_end,
        metadata: usageData.metadata || {},
      })
      .select()
      .single();

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
   * Récupérer la consommation par service
   */
  async getServiceUsage(siteId, service, periodStart, periodEnd) {
    const { data, error } = await supabase
      .from('cimolace_usage_logs')
      .select('*')
      .eq('site_id', siteId)
      .eq('service', service)
      .gte('period_start', periodStart)
      .lte('period_end', periodEnd)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer la consommation par métrique
   */
  async getMetricUsage(siteId, metric, periodStart, periodEnd) {
    const { data, error } = await supabase
      .from('cimolace_usage_logs')
      .select('*')
      .eq('site_id', siteId)
      .eq('metric', metric)
      .gte('period_start', periodStart)
      .lte('period_end', periodEnd)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Calculer la consommation totale d'un site sur une période
   */
  async getTotalUsage(siteId, periodStart, periodEnd) {
    const { data, error } = await supabase
      .from('cimolace_usage_logs')
      .select('metric, quantity, unit')
      .eq('site_id', siteId)
      .gte('period_start', periodStart)
      .lte('period_end', periodEnd);

    if (error) throw error;

    // Agréger par métrique
    const aggregated = {};
    data.forEach(log => {
      if (!aggregated[log.metric]) {
        aggregated[log.metric] = { total: 0, unit: log.unit };
      }
      aggregated[log.metric].total += log.quantity;
    });

    return aggregated;
  }

  /**
   * Récupérer tous les logs de consommation avec filtres
   */
  async getAllUsageLogs(filters = {}) {
    let query = supabase.from('cimolace_usage_logs').select(`
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
    `);

    if (filters.site_id) {
      query = query.eq('site_id', filters.site_id);
    }

    if (filters.service) {
      query = query.eq('service', filters.service);
    }

    if (filters.metric) {
      query = query.eq('metric', filters.metric);
    }

    if (filters.period_start && filters.period_end) {
      query = query.gte('period_start', filters.period_start);
      query = query.lte('period_end', filters.period_end);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer la consommation du mois courant
   */
  async getCurrentMonthUsage(siteId) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return this.getTotalUsage(siteId, startOfMonth.toISOString(), endOfMonth.toISOString());
  }

  /**
   * Comparer la consommation avec les quotas
   */
  async compareWithQuotas(siteId) {
    const services = await supabase
      .from('cimolace_services')
      .select('service_key, quota_limit, quota_used')
      .eq('site_id', siteId)
      .eq('status', 'active');

    if (services.error) throw services.error;

    const comparison = [];
    services.data.forEach(service => {
      if (service.quota_limit) {
        const percentage = (service.quota_used / service.quota_limit) * 100;
        comparison.push({
          service: service.service_key,
          quota_limit: service.quota_limit,
          quota_used: service.quota_used,
          percentage: Math.round(percentage),
          is_over_limit: service.quota_used > service.quota_limit,
          is_near_limit: percentage >= 80 && percentage < 100,
        });
      }
    });

    return comparison;
  }
}

// Export singleton instance
export const usageEngine = new UsageEngine();
