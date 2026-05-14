/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE CONTRACT ENGINE
 * Moteur de gestion des contrats clients
 * ═══════════════════════════════════════════════════════════════
 */

import { supabase } from '@/lib/supabase';
import { ContractType, ContractStatus } from './contractTypes.js';

/**
 * ContractEngine - Moteur de gestion des contrats
 */
export class ContractEngine {
  /**
   * Créer un nouveau contrat
   */
  async createContract(contractData) {
    const { data, error } = await supabase
      .from('cimolace_contracts')
      .insert({
        client_id: contractData.client_id,
        site_id: contractData.site_id || null,
        contract_type: contractData.contract_type || ContractType.SUBSCRIPTION,
        setup_amount: contractData.setup_amount || 0,
        monthly_amount: contractData.monthly_amount || 0,
        min_duration_months: contractData.min_duration_months || null,
        start_date: contractData.start_date || null,
        end_date: contractData.end_date || null,
        status: contractData.status || ContractStatus.DRAFT,
        special_conditions: contractData.special_conditions || null,
        contract_pdf_url: contractData.contract_pdf_url || null,
        signature_date: contractData.signature_date || null,
        internal_responsible: contractData.internal_responsible || null,
        metadata: contractData.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer un contrat par ID
   */
  async getContractById(contractId) {
    const { data, error } = await supabase
      .from('cimolace_contracts')
      .select(`
        *,
        cimolace_clients (
          id,
          name,
          email
        ),
        cimolace_sites (
          id,
          name,
          domain
        )
      `)
      .eq('id', contractId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les contrats d'un client
   */
  async getContractsByClient(clientId) {
    const { data, error } = await supabase
      .from('cimolace_contracts')
      .select(`
        *,
        cimolace_sites (
          id,
          name,
          domain
        )
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les contrats d'un site
   */
  async getContractsBySite(siteId) {
    const { data, error } = await supabase
      .from('cimolace_contracts')
      .select(`
        *,
        cimolace_clients (
          id,
          name,
          email
        )
      `)
      .eq('site_id', siteId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer tous les contrats avec filtres
   */
  async getAllContracts(filters = {}) {
    let query = supabase.from('cimolace_contracts').select(`
      *,
      cimolace_clients (
        id,
        name,
        email
      ),
      cimolace_sites (
        id,
        name,
        domain
      )
    `);

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.contract_type) {
      query = query.eq('contract_type', filters.contract_type);
    }

    if (filters.client_id) {
      query = query.eq('client_id', filters.client_id);
    }

    if (filters.site_id) {
      query = query.eq('site_id', filters.site_id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Mettre à jour un contrat
   */
  async updateContract(contractId, updates) {
    const { data, error } = await supabase
      .from('cimolace_contracts')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contractId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Signer un contrat
   */
  async signContract(contractId, signatureDate, pdfUrl) {
    return this.updateContract(contractId, {
      status: ContractStatus.SIGNED,
      signature_date: signatureDate,
      contract_pdf_url: pdfUrl,
    });
  }

  /**
   * Activer un contrat
   */
  async activateContract(contractId) {
    return this.updateContract(contractId, {
      status: ContractStatus.ACTIVE,
    });
  }

  /**
   * Annuler un contrat
   */
  async cancelContract(contractId, reason) {
    return this.updateContract(contractId, {
      status: ContractStatus.CANCELLED,
      special_conditions: reason,
    });
  }

  /**
   * Marquer un contrat comme expiré
   */
  async expireContract(contractId) {
    return this.updateContract(contractId, {
      status: ContractStatus.EXPIRED,
    });
  }
}

// Export singleton instance
export const contractEngine = new ContractEngine();
