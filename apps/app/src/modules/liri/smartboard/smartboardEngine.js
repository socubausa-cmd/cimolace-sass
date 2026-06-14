/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE LIRI SCHOOL - SMARTBOARD ENGINE
 * Moteur de gestion des smartboards générique
 * ═══════════════════════════════════════════════════════════════
 */

import { supabase } from '../../../lib/customSupabaseClient';
import { SmartboardStatus, SmartboardTheme } from './smartboardTypes.js';

class SmartboardEngine {
  constructor(tenantSlug) {
    this.tenantSlug = tenantSlug;
    this.supabase = this.createSupabaseClient();
  }

  createSupabaseClient() {
    return supabase;
  }

  async getSmartboards(filters = {}) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return [];
    }

    try {
      let query = this.supabase
        .from('smartboards')
        .select('*')
        .eq('metadata->>tenant', this.tenantSlug);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching smartboards:', error);
        return [];
      }

      return data;
    } catch (error) {
      console.error('Error fetching smartboards:', error);
      return [];
    }
  }

  async getSmartboardById(smartboardId) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('smartboards')
        .select('*')
        .eq('id', smartboardId)
        .eq('metadata->>tenant', this.tenantSlug)
        .maybeSingle();

      if (error || !data) {
        console.error('Error fetching smartboard:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching smartboard:', error);
      return null;
    }
  }
}

export function createSmartboardEngine(tenantSlug) {
  return new SmartboardEngine(tenantSlug);
}

export default SmartboardEngine;
