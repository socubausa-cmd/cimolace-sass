/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE LIRI SCHOOL - REPLAY ENGINE
 * Moteur de gestion des replays générique
 * ═══════════════════════════════════════════════════════════════
 */

import { supabase } from '../../../lib/customSupabaseClient';
import { ReplayStatus, ReplayQuality } from './replayTypes.js';

class ReplayEngine {
  constructor(tenantSlug) {
    this.tenantSlug = tenantSlug;
    this.supabase = this.createSupabaseClient();
  }

  createSupabaseClient() {
    return supabase;
  }

  async getReplays(filters = {}) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return [];
    }

    try {
      let query = this.supabase
        .from('replays')
        .select('*')
        .eq('metadata->>tenant', this.tenantSlug);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching replays:', error);
        return [];
      }

      return data;
    } catch (error) {
      console.error('Error fetching replays:', error);
      return [];
    }
  }

  async getReplayById(replayId) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('replays')
        .select('*')
        .eq('id', replayId)
        .eq('metadata->>tenant', this.tenantSlug)
        .maybeSingle();

      if (error || !data) {
        console.error('Error fetching replay:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching replay:', error);
      return null;
    }
  }
}

export function createReplayEngine(tenantSlug) {
  return new ReplayEngine(tenantSlug);
}

export default ReplayEngine;
