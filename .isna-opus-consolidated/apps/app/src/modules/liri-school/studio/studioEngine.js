/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE LIRI SCHOOL - STUDIO ENGINE
 * Moteur de gestion des studios générique
 * ═══════════════════════════════════════════════════════════════
 */

import { createClient } from '@supabase/supabase-js';
import { StudioStatus, StudioType } from './studioTypes.js';

class StudioEngine {
  constructor(tenantSlug) {
    this.tenantSlug = tenantSlug;
    this.supabase = this.createSupabaseClient();
  }

  createSupabaseClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Supabase URL or Anon Key not configured');
      return null;
    }

    return createClient(supabaseUrl, supabaseAnonKey);
  }

  async getStudios(filters = {}) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return [];
    }

    try {
      let query = this.supabase
        .from('studios')
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
        console.error('Error fetching studios:', error);
        return [];
      }

      return data;
    } catch (error) {
      console.error('Error fetching studios:', error);
      return [];
    }
  }

  async getStudioById(studioId) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('studios')
        .select('*')
        .eq('id', studioId)
        .eq('metadata->>tenant', this.tenantSlug)
        .maybeSingle();

      if (error || !data) {
        console.error('Error fetching studio:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching studio:', error);
      return null;
    }
  }
}

export function createStudioEngine(tenantSlug) {
  return new StudioEngine(tenantSlug);
}

export default StudioEngine;
