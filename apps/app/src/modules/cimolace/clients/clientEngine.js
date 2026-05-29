/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE CLIENT ENGINE
 * Moteur de gestion des clients CIMOLACE
 * ═══════════════════════════════════════════════════════════════
 */

import { supabase } from '@/lib/supabase';
import { ClientStatus, ClientType } from './clientTypes.js';

/**
 * ClientEngine - Moteur de gestion des clients
 */
export class ClientEngine {
  /**
   * Créer un nouveau client
   */
  async createClient(clientData) {
    const portalSlug =
      clientData.portal_slug != null && String(clientData.portal_slug).trim() !== ''
        ? String(clientData.portal_slug).trim().toLowerCase()
        : null;

    const insertRow = {
      name: clientData.name,
      business_name: clientData.business_name || null,
      client_type: clientData.client_type || ClientType.OTHER,
      contact_person: clientData.contact_person || null,
      email: clientData.email,
      phone: clientData.phone || null,
      country: clientData.country || null,
      status: clientData.status || ClientStatus.PROSPECT,
      source: clientData.source || null,
      commercial_responsible: clientData.commercial_responsible || null,
      internal_notes: clientData.internal_notes || null,
    };
    if (portalSlug) {
      insertRow.portal_slug = portalSlug;
    }

    const { data, error } = await supabase.from('cimolace_clients').insert(insertRow).select().single();

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer un client par ID
   */
  async getClientById(clientId) {
    const { data, error } = await supabase
      .from('cimolace_clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer un client par email
   */
  async getClientByEmail(email) {
    const trimmed = String(email || '').trim();
    if (!trimmed) return null;

    let { data, error } = await supabase
      .from('cimolace_clients')
      .select('*')
      .eq('email', trimmed)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;

    const lower = trimmed.toLowerCase();
    if (lower !== trimmed) {
      ({ data, error } = await supabase
        .from('cimolace_clients')
        .select('*')
        .eq('email', lower)
        .maybeSingle());
      if (error) throw error;
    }

    return data ?? null;
  }

  /** @param {string} slug URL segment (stored lowercase). */
  async getClientByPortalSlug(slug) {
    const key = String(slug || '').trim().toLowerCase();
    if (!key) return null;

    const { data, error } = await supabase
      .from('cimolace_clients')
      .select('*')
      .eq('portal_slug', key)
      .maybeSingle();

    if (error) throw error;
    return data ?? null;
  }

  /**
   * Résout : UUID client, email, ou portal_slug (ex. isna).
   * @param {string} ref
   * @returns {Promise<object|null>}
   */
  async resolveClientRef(ref) {
    const key = String(ref || '').trim();
    if (!key) return null;

    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRe.test(key)) {
      const { data, error } = await supabase
        .from('cimolace_clients')
        .select('*')
        .eq('id', key)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    }

    if (key.includes('@')) {
      return this.getClientByEmail(key);
    }

    const bySlug = await this.getClientByPortalSlug(key);
    if (bySlug) return bySlug;

    return this.getClientByEmail(key);
  }

  /**
   * Site IDs liés au client métier via contrats (cimolace_sites.tenant_id = cimolace_tenants, pas client).
   */
  async getClientContractSiteIds(clientId) {
    const { data, error } = await supabase
      .from('cimolace_contracts')
      .select('site_id')
      .eq('client_id', clientId)
      .not('site_id', 'is', null);

    if (error) throw error;
    return [...new Set((data || []).map((r) => r.site_id).filter(Boolean))];
  }

  /**
   * Récupérer tous les clients avec filtres
   */
  async getAllClients(filters = {}) {
    let query = supabase.from('cimolace_clients').select('*');

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.client_type) {
      query = query.eq('client_type', filters.client_type);
    }

    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Mettre à jour un client
   */
  async updateClient(clientId, updates) {
    const { data, error } = await supabase
      .from('cimolace_clients')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', clientId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Suspendre un client
   */
  async suspendClient(clientId, reason) {
    return this.updateClient(clientId, {
      status: ClientStatus.SUSPENDED,
      internal_notes: reason,
    });
  }

  /**
   * Activer un client
   */
  async activateClient(clientId) {
    return this.updateClient(clientId, {
      status: ClientStatus.ACTIVE,
    });
  }

  /**
   * Annuler un client
   */
  async cancelClient(clientId, reason) {
    return this.updateClient(clientId, {
      status: ClientStatus.CANCELLED,
      internal_notes: reason,
    });
  }

  /**
   * Récupérer les sites d'un client (via contrats actifs ou passés ayant un site_id)
   */
  async getClientSites(clientId) {
    const contractSiteIds = await this.getClientContractSiteIds(clientId);

    const directSitesQuery = supabase
      .from('cimolace_sites')
      .select('*')
      .eq('client_id', clientId);

    const contractSitesQuery = contractSiteIds.length > 0
      ? supabase
          .from('cimolace_sites')
          .select('*')
          .in('id', contractSiteIds)
      : Promise.resolve({ data: [], error: null });

    const [directRes, contractRes] = await Promise.all([directSitesQuery, contractSitesQuery]);

    if (directRes.error) throw directRes.error;
    if (contractRes.error) throw contractRes.error;

    const byId = new Map();
    [...(directRes.data || []), ...(contractRes.data || [])].forEach((site) => {
      if (site?.id) byId.set(site.id, site);
    });

    return [...byId.values()].sort((a, b) =>
      String(b.created_at || '').localeCompare(String(a.created_at || '')),
    );
  }

  /**
   * Récupérer les contrats d'un client
   */
  async getClientContracts(clientId) {
    const { data, error } = await supabase
      .from('cimolace_contracts')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les abonnements d'un client (via ses sites)
   */
  async getClientSubscriptions(clientId) {
    const siteIds = (await this.getClientSites(clientId)).map((s) => s.id);
    if (siteIds.length === 0) return [];

    const { data, error } = await supabase
      .from('cimolace_subscriptions')
      .select(`
        *,
        cimolace_sites (
          id,
          name,
          tenant_id
        )
      `)
      .in('site_id', siteIds);

    if (error) throw error;
    return data || [];
  }

  /**
   * Récupérer les factures d'un client (via ses sites)
   */
  async getClientInvoices(clientId) {
    const siteIds = (await this.getClientSites(clientId)).map((s) => s.id);
    if (siteIds.length === 0) return [];

    const { data, error } = await supabase
      .from('cimolace_invoices')
      .select(`
        *,
        cimolace_sites (
          id,
          name,
          tenant_id
        )
      `)
      .in('site_id', siteIds)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Récupérer les tickets d'un client (via ses sites)
   */
  async getClientTickets(clientId) {
    const siteIds = (await this.getClientSites(clientId)).map((s) => s.id);
    if (siteIds.length === 0) return [];

    const { data, error } = await supabase
      .from('cimolace_tickets')
      .select(`
        *,
        cimolace_sites (
          id,
          name,
          tenant_id
        )
      `)
      .in('site_id', siteIds)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Récupérer la vue d'ensemble des clients
   */
  async getClientsOverview() {
    const { data, error } = await supabase
      .from('cimolace_clients_overview')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }
}

// Export singleton instance
export const clientEngine = new ClientEngine();
