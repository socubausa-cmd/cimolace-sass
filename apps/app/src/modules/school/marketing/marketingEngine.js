/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE LIRI SCHOOL - MARKETING ENGINE
 * Moteur de gestion marketing générique
 * ═══════════════════════════════════════════════════════════════
 */

import { supabase } from '../../../lib/customSupabaseClient';

class MarketingEngine {
  constructor(tenantSlug) {
    this.tenantSlug = tenantSlug;
    this.supabase = this.createSupabaseClient();
  }

  createSupabaseClient() {
    return supabase;
  }

  async getCampaigns(filters = {}) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return [];
    }

    try {
      let query = this.supabase
        .from('marketing_campaigns')
        .select('*')
        .eq('metadata->>tenant', this.tenantSlug);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching campaigns:', error);
        return [];
      }

      return data;
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      return [];
    }
  }

  async getCampaignById(campaignId) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('marketing_campaigns')
        .select('*')
        .eq('id', campaignId)
        .eq('metadata->>tenant', this.tenantSlug)
        .maybeSingle();

      if (error || !data) {
        console.error('Error fetching campaign:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching campaign:', error);
      return null;
    }
  }

  async getLeadMagnet(leadMagnetId) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('lead_magnets')
        .select('*')
        .eq('id', leadMagnetId)
        .eq('metadata->>tenant', this.tenantSlug)
        .maybeSingle();

      if (error || !data) {
        console.error('Error fetching lead magnet:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching lead magnet:', error);
      return null;
    }
  }
}

export function createMarketingEngine(tenantSlug) {
  return new MarketingEngine(tenantSlug);
}

export default MarketingEngine;
