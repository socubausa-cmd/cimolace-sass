/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE LIRI SCHOOL - LIVE ENGINE
 * Moteur de gestion des lives générique
 * ═══════════════════════════════════════════════════════════════
 */

import { supabase } from '../../../lib/customSupabaseClient';
import { LiveStatus, LiveType } from './liveTypes.js';

class LiveEngine {
  constructor(tenantSlug) {
    this.tenantSlug = tenantSlug;
    this.supabase = this.createSupabaseClient();
  }

  createSupabaseClient() {
    return supabase;
  }

  async getLiveSessions(filters = {}) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return [];
    }

    try {
      let query = this.supabase
        .from('live_sessions')
        .select('*')
        .eq('metadata->>tenant', this.tenantSlug);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.type) {
        query = query.eq('type', filters.type);
      }

      const { data, error } = await query.order('scheduled_at', { ascending: true });

      if (error) {
        console.error('Error fetching live sessions:', error);
        return [];
      }

      return data;
    } catch (error) {
      console.error('Error fetching live sessions:', error);
      return [];
    }
  }

  async getLiveSessionById(sessionId) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('live_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('metadata->>tenant', this.tenantSlug)
        .maybeSingle();

      if (error || !data) {
        console.error('Error fetching live session:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching live session:', error);
      return null;
    }
  }
}

export function createLiveEngine(tenantSlug) {
  return new LiveEngine(tenantSlug);
}

export default LiveEngine;
