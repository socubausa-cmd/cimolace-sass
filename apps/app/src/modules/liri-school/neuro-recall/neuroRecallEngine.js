/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE LIRI SCHOOL - NEURO RECALL ENGINE
 * Moteur de gestion du neuro recall générique
 * ═══════════════════════════════════════════════════════════════
 */

import { supabase } from '../../../lib/customSupabaseClient';
import { NeuroRecallStatus, NeuroRecallType } from './neuroRecallTypes.js';

class NeuroRecallEngine {
  constructor(tenantSlug) {
    this.tenantSlug = tenantSlug;
    this.supabase = this.createSupabaseClient();
  }

  createSupabaseClient() {
    return supabase;
  }

  async getNeuroRecalls(filters = {}) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return [];
    }

    try {
      let query = this.supabase
        .from('neuro_recalls')
        .select('*')
        .eq('metadata->>tenant', this.tenantSlug);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.type) {
        query = query.eq('type', filters.type);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching neuro recalls:', error);
        return [];
      }

      return data;
    } catch (error) {
      console.error('Error fetching neuro recalls:', error);
      return [];
    }
  }

  async getNeuroRecallById(recallId) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('neuro_recalls')
        .select('*')
        .eq('id', recallId)
        .eq('metadata->>tenant', this.tenantSlug)
        .maybeSingle();

      if (error || !data) {
        console.error('Error fetching neuro recall:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching neuro recall:', error);
      return null;
    }
  }
}

export function createNeuroRecallEngine(tenantSlug) {
  return new NeuroRecallEngine(tenantSlug);
}

export default NeuroRecallEngine;
