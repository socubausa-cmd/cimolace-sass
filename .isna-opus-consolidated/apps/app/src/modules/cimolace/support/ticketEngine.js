/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE TICKET ENGINE
 * Moteur de gestion des tickets support
 * ═══════════════════════════════════════════════════════════════
 */

import { supabase } from '@/lib/supabase';
import { TicketStatus, TicketPriority, TicketCategory } from './ticketTypes.js';

/**
 * TicketEngine - Moteur de gestion des tickets
 */
export class TicketEngine {
  /**
   * Créer un nouveau ticket
   */
  async createTicket(ticketData) {
    const { data, error } = await supabase
      .from('cimolace_tickets')
      .insert({
        site_id: ticketData.site_id,
        ticket_number: ticketData.ticket_number || this.generateTicketNumber(),
        subject: ticketData.subject,
        description: ticketData.description,
        category: ticketData.category || TicketCategory.GENERAL,
        priority: ticketData.priority || TicketPriority.MEDIUM,
        status: ticketData.status || TicketStatus.OPEN,
        contact_email: ticketData.contact_email || null,
        assignee: ticketData.assignee || null,
        resolution: ticketData.resolution || null,
        resolved_at: ticketData.resolved_at || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Générer un numéro de ticket
   */
  generateTicketNumber() {
    return `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  /**
   * Récupérer un ticket par ID
   */
  async getTicketById(ticketId) {
    const { data, error } = await supabase
      .from('cimolace_tickets')
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
      .eq('id', ticketId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer un ticket par numéro
   */
  async getTicketByNumber(ticketNumber) {
    const { data, error } = await supabase
      .from('cimolace_tickets')
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
      .eq('ticket_number', ticketNumber)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les tickets d'un site
   */
  async getTicketsBySite(siteId) {
    const { data, error } = await supabase
      .from('cimolace_tickets')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer tous les tickets avec filtres
   */
  async getAllTickets(filters = {}) {
    let query = supabase.from('cimolace_tickets').select(`
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

    if (filters.priority) {
      query = query.eq('priority', filters.priority);
    }

    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    if (filters.assignee) {
      query = query.eq('assignee', filters.assignee);
    }

    if (filters.site_id) {
      query = query.eq('site_id', filters.site_id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Assigner un ticket
   */
  async assignTicket(ticketId, assignee) {
    const { data, error } = await supabase
      .from('cimolace_tickets')
      .update({
        assignee: assignee,
        status: TicketStatus.IN_PROGRESS,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Ajouter un message à un ticket
   */
  async addMessage(ticketId, message, author = 'support') {
    const { data, error } = await supabase
      .from('cimolace_ticket_messages')
      .insert({
        ticket_id: ticketId,
        message: message,
        author: author,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les messages d'un ticket
   */
  async getTicketMessages(ticketId) {
    const { data, error } = await supabase
      .from('cimolace_ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  }

  /**
   * Mettre à jour le statut d'un ticket
   */
  async updateTicketStatus(ticketId, status) {
    const { data, error } = await supabase
      .from('cimolace_tickets')
      .update({
        status: status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Résoudre un ticket
   */
  async resolveTicket(ticketId, resolution) {
    const { data, error } = await supabase
      .from('cimolace_tickets')
      .update({
        status: TicketStatus.RESOLVED,
        resolution: resolution,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Fermer un ticket
   */
  async closeTicket(ticketId) {
    const { data, error } = await supabase
      .from('cimolace_tickets')
      .update({
        status: TicketStatus.CLOSED,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Réouvrir un ticket
   */
  async reopenTicket(ticketId) {
    const { data, error } = await supabase
      .from('cimolace_tickets')
      .update({
        status: TicketStatus.OPEN,
        resolution: null,
        resolved_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Changer la priorité d'un ticket
   */
  async changeTicketPriority(ticketId, priority) {
    const { data, error } = await supabase
      .from('cimolace_tickets')
      .update({
        priority: priority,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les tickets ouverts
   */
  async getOpenTickets() {
    const { data, error } = await supabase
      .from('cimolace_tickets')
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
      .eq('status', TicketStatus.OPEN)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les tickets en cours
   */
  async getInProgressTickets() {
    const { data, error } = await supabase
      .from('cimolace_tickets')
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
      .eq('status', TicketStatus.IN_PROGRESS)
      .order('priority', { ascending: false })
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data;
  }
}

// Export singleton instance
export const ticketEngine = new TicketEngine();
