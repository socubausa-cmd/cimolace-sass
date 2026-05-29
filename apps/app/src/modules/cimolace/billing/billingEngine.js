/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE BILLING ENGINE
 * Moteur de gestion des paiements et factures
 * ═══════════════════════════════════════════════════════════════
 */

import { supabase } from '@/lib/supabase';
import { PaymentStatus, PaymentType, InvoiceStatus, InvoiceType, BillingMode } from './billingTypes.js';

/**
 * BillingEngine - Moteur de gestion des paiements et factures
 */
export class BillingEngine {
  /**
   * Créer un paiement
   */
  async createPayment(paymentData) {
    const { data, error } = await supabase
      .from('cimolace_payments')
      .insert({
        site_id: paymentData.site_id || null,
        subscription_id: paymentData.subscription_id || null,
        type: paymentData.type || PaymentType.SUBSCRIPTION,
        amount: paymentData.amount,
        currency: paymentData.currency || 'EUR',
        status: paymentData.status || PaymentStatus.PENDING,
        provider: paymentData.provider,
        provider_payment_id: paymentData.provider_payment_id || null,
        provider_invoice_url: paymentData.provider_invoice_url || null,
        invoice_number: paymentData.invoice_number || null,
        due_date: paymentData.due_date || null,
        paid_at: paymentData.paid_at || null,
        metadata: paymentData.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer un paiement par ID
   */
  async getPaymentById(paymentId) {
    const { data, error } = await supabase
      .from('cimolace_payments')
      .select(`
        *,
        cimolace_sites (
          id,
          name,
          domain
        ),
        cimolace_subscriptions (
          id,
          plan,
          provider
        )
      `)
      .eq('id', paymentId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les paiements d'un site
   */
  async getPaymentsBySite(siteId) {
    const { data, error } = await supabase
      .from('cimolace_payments')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer tous les paiements avec filtres
   */
  async getAllPayments(filters = {}) {
    let query = supabase.from('cimolace_payments').select(`
      *,
      cimolace_sites (
        id,
        name,
        domain,
        cimolace_tenants (
          id,
          name,
          email
        )
      )
    `);

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.type) {
      query = query.eq('type', filters.type);
    }

    if (filters.provider) {
      query = query.eq('provider', filters.provider);
    }

    if (filters.site_id) {
      query = query.eq('site_id', filters.site_id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Marquer un paiement comme payé
   */
  async markPaymentPaid(paymentId, providerPaymentId) {
    const { data, error } = await supabase
      .from('cimolace_payments')
      .update({
        status: PaymentStatus.CONFIRMED,
        provider_payment_id: providerPaymentId,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Marquer un paiement comme échoué
   */
  async markPaymentFailed(paymentId) {
    const { data, error } = await supabase
      .from('cimolace_payments')
      .update({
        status: PaymentStatus.FAILED,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Créer une facture
   */
  async createInvoice(invoiceData) {
    const { data, error } = await supabase
      .from('cimolace_invoices')
      .insert({
        site_id: invoiceData.site_id,
        billing_profile_id: invoiceData.billing_profile_id,
        invoice_number: invoiceData.invoice_number,
        amount: invoiceData.amount,
        currency: invoiceData.currency || 'EUR',
        type: invoiceData.type || InvoiceType.MONTHLY,
        status: invoiceData.status || InvoiceStatus.PENDING,
        due_date: invoiceData.due_date,
        paid_at: invoiceData.paid_at || null,
        pdf_url: invoiceData.pdf_url || null,
        metadata: invoiceData.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer une facture par ID
   */
  async getInvoiceById(invoiceId) {
    const { data, error } = await supabase
      .from('cimolace_invoices')
      .select(`
        *,
        cimolace_sites (
          id,
          name,
          domain,
          cimolace_tenants (
            id,
            name,
            email
          )
        ),
        cimolace_billing_profiles (
          id,
          plan_key,
          billing_mode
        )
      `)
      .eq('id', invoiceId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les factures d'un site
   */
  async getInvoicesBySite(siteId) {
    const { data, error } = await supabase
      .from('cimolace_invoices')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer toutes les factures avec filtres
   */
  async getAllInvoices(filters = {}) {
    let query = supabase.from('cimolace_invoices').select(`
      *,
      cimolace_sites (
        id,
        name,
        domain,
        cimolace_tenants (
          id,
          name,
          email
        )
      )
    `);

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.type) {
      query = query.eq('type', filters.type);
    }

    if (filters.site_id) {
      query = query.eq('site_id', filters.site_id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Marquer une facture comme payée
   */
  async markInvoicePaid(invoiceId) {
    const { data, error } = await supabase
      .from('cimolace_invoices')
      .update({
        status: InvoiceStatus.PAID,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Annuler une facture
   */
  async cancelInvoice(invoiceId) {
    const { data, error } = await supabase
      .from('cimolace_invoices')
      .update({
        status: InvoiceStatus.CANCELLED,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les paiements en attente
   */
  async getPendingPayments() {
    const { data, error } = await supabase
      .from('cimolace_pending_payments')
      .select('*')
      .order('due_date', { ascending: true });

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les factures impayées
   */
  async getOverdueInvoices() {
    const { data, error } = await supabase
      .from('cimolace_invoices')
      .select(`
        *,
        cimolace_sites (
          id,
          name,
          domain,
          cimolace_tenants (
            id,
            name,
            email
          )
        )
      `)
      .eq('status', InvoiceStatus.OVERDUE)
      .order('due_date', { ascending: true });

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les profils de facturation
   */
  async getBillingProfiles(filters = {}) {
    let query = supabase.from('cimolace_billing_profiles').select(`
      *,
      cimolace_sites (
        id,
        name,
        domain,
        cimolace_tenants (
          id,
          name,
          email
        )
      )
    `);

    if (filters.status) {
      query = query.eq('subscription_status', filters.status);
    }

    if (filters.site_id) {
      query = query.eq('site_id', filters.site_id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les échéanciers de paiement
   */
  async getPaymentSchedules(filters = {}) {
    let query = supabase.from('cimolace_payment_schedules').select(`
      *,
      cimolace_sites (
        id,
        name,
        domain,
        cimolace_tenants (
          id,
          name,
          email
        )
      )
    `);

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.site_id) {
      query = query.eq('site_id', filters.site_id);
    }

    const { data, error } = await query.order('due_date', { ascending: true });

    if (error) throw error;
    return data;
  }

  /**
   * Marquer un échéancier comme payé
   */
  async markSchedulePaid(scheduleId, providerPaymentId) {
    const { data, error } = await supabase
      .from('cimolace_payment_schedules')
      .update({
        status: 'paid',
        provider_payment_id: providerPaymentId,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', scheduleId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Marquer un échéancier comme en retard
   */
  async markScheduleLate(scheduleId) {
    const { data, error } = await supabase
      .from('cimolace_payment_schedules')
      .update({
        status: 'late',
        reminder_count: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', scheduleId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Incrémenter le compteur de relance
   */
  async incrementScheduleReminder(scheduleId) {
    const { data, error } = await supabase
      .from('cimolace_payment_schedules')
      .rpc('increment_reminder', { schedule_id: scheduleId });

    if (error) throw error;
    return data;
  }
}

// Export singleton instance
export const billingEngine = new BillingEngine();
