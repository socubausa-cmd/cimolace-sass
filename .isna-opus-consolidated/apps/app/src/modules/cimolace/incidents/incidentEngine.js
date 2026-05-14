/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE INCIDENT ENGINE
 * Moteur de gestion des incidents techniques
 * ═══════════════════════════════════════════════════════════════
 */

import { supabase } from '@/lib/supabase';
import { IncidentStatus, IncidentSeverity } from './incidentTypes.js';

/**
 * IncidentEngine - Moteur de gestion des incidents
 */
export class IncidentEngine {
  /**
   * Créer un nouvel incident
   */
  async createIncident(incidentData) {
    const { data, error } = await supabase
      .from('cimolace_change_history')
      .insert({
        action: 'incident_created',
        entity_type: 'incident',
        entity_id: incidentData.entity_id || null,
        description: incidentData.description,
        site_id: incidentData.site_id || null,
        tenant_id: incidentData.tenant_id || null,
        changed_by: incidentData.changed_by || 'system',
        metadata: incidentData.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les incidents récents
   */
  async getRecentIncidents(limit = 50) {
    const { data, error } = await supabase
      .from('cimolace_change_history')
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
      .eq('action', 'incident_created')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les incidents par site
   */
  async getSiteIncidents(siteId) {
    const { data, error } = await supabase
      .from('cimolace_change_history')
      .select('*')
      .eq('site_id', siteId)
      .eq('action', 'incident_created')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les incidents par gravité (via metadata)
   */
  async getIncidentsBySeverity(severity) {
    const { data, error } = await supabase
      .from('cimolace_change_history')
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
      .eq('action', 'incident_created')
      .contains('metadata', { severity: severity })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les incidents critiques
   */
  async getCriticalIncidents() {
    return this.getIncidentsBySeverity(IncidentSeverity.CRITICAL);
  }

  /**
   * Récupérer les incidents en cours
   */
  async getActiveIncidents() {
    const { data, error } = await supabase
      .from('cimolace_change_history')
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
      .eq('action', 'incident_created')
      .not('metadata->>status', 'in', ['"resolved"', '"closed"'])
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Mettre à jour le statut d'un incident
   */
  async updateIncidentStatus(changeHistoryId, status, resolution = null) {
    const { data, error } = await supabase
      .from('cimolace_change_history')
      .update({
        metadata: {
          status: status,
          resolution: resolution,
        },
        description: resolution || `Incident status updated to ${status}`,
      })
      .eq('id', changeHistoryId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Résoudre un incident
   */
  async resolveIncident(changeHistoryId, resolution) {
    return this.updateIncidentStatus(changeHistoryId, IncidentStatus.RESOLVED, resolution);
  }

  /**
   * Récupérer l'historique des modifications pour un site
   */
  async getSiteHistory(siteId, limit = 100) {
    const { data, error } = await supabase
      .from('cimolace_change_history')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer l'historique des modifications pour un client
   */
  async getClientHistory(tenantId, limit = 100) {
    const { data, error } = await supabase
      .from('cimolace_change_history')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  /**
   * Enregistrer une modification
   */
  async logChange(changeData) {
    const { data, error } = await supabase
      .from('cimolace_change_history')
      .insert({
        action: changeData.action,
        entity_type: changeData.entity_type || null,
        entity_id: changeData.entity_id || null,
        description: changeData.description || null,
        old_values: changeData.old_values || null,
        new_values: changeData.new_values || null,
        site_id: changeData.site_id || null,
        tenant_id: changeData.tenant_id || null,
        changed_by: changeData.changed_by || 'system',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

// Export singleton instance
export const incidentEngine = new IncidentEngine();
