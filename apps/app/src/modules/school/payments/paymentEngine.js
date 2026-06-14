/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE LIRI SCHOOL - PAYMENT ENGINE
 * Moteur de gestion des paiements générique
 * ═══════════════════════════════════════════════════════════════
 */

import { supabase } from '../../../lib/customSupabaseClient';

class PaymentEngine {
  constructor(tenantSlug) {
    this.tenantSlug = tenantSlug;
    this.supabase = this.createSupabaseClient();
  }

  createSupabaseClient() {
    return supabase;
  }

  async getPayments(filters = {}) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return [];
    }

    try {
      let query = this.supabase
        .from('payments')
        .select('*')
        .eq('metadata->>tenant', this.tenantSlug);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching payments:', error);
        return [];
      }

      return data;
    } catch (error) {
      console.error('Error fetching payments:', error);
      return [];
    }
  }

  async getPaymentById(paymentId) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .eq('metadata->>tenant', this.tenantSlug)
        .maybeSingle();

      if (error || !data) {
        console.error('Error fetching payment:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching payment:', error);
      return null;
    }
  }
}

export function createPaymentEngine(tenantSlug) {
  return new PaymentEngine(tenantSlug);
}

export default PaymentEngine;
