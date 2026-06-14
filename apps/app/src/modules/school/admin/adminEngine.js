/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE LIRI SCHOOL - ADMIN ENGINE
 * Moteur de gestion administrative générique
 * ═══════════════════════════════════════════════════════════════
 */

import { supabase } from '../../../lib/customSupabaseClient';

class AdminEngine {
  constructor(tenantSlug) {
    this.tenantSlug = tenantSlug;
    this.supabase = this.createSupabaseClient();
  }

  createSupabaseClient() {
    return supabase;
  }

  async getAdmins(filters = {}) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return [];
    }

    try {
      let query = this.supabase
        .from('profiles')
        .select('*')
        .in('role', ['owner', 'admin']);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching admins:', error);
        return [];
      }

      return data;
    } catch (error) {
      console.error('Error fetching admins:', error);
      return [];
    }
  }

  async getAdminById(adminId) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', adminId)
        .in('role', ['owner', 'admin'])
        .maybeSingle();

      if (error || !data) {
        console.error('Error fetching admin:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching admin:', error);
      return null;
    }
  }

  async getBookings(filters = {}) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return [];
    }

    try {
      let query = this.supabase
        .from('bookings')
        .select('*')
        .eq('metadata->>tenant', this.tenantSlug);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching bookings:', error);
        return [];
      }

      return data;
    } catch (error) {
      console.error('Error fetching bookings:', error);
      return [];
    }
  }
}

export function createAdminEngine(tenantSlug) {
  return new AdminEngine(tenantSlug);
}

export default AdminEngine;
