/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE PAYMENT STATUS - VÉRIFICATION DU STATUT DE PAIEMENT
 * ═══════════════════════════════════════════════════════════════
 */

import { getPaymentEngine } from './payment-engine.js';

// ═══════════════════════════════════════════════════════════════
// CLASS PAYMENT STATUS MANAGER
// ═══════════════════════════════════════════════════════════════

class PaymentStatusManager {
  constructor() {
    this.paymentEngine = getPaymentEngine();
  }

  /**
   * Vérifie le statut d'un paiement
   */
  async checkPaymentStatus(saleId) {
    try {
      const status = await this.paymentEngine.getPaymentStatus(saleId);
      return {
        success: true,
        ...status,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: 'unknown',
      };
    }
  }

  /**
   * Vérifie si un paiement est confirmé
   */
  async isPaymentConfirmed(saleId) {
    const result = await this.checkPaymentStatus(saleId);
    return result.status === 'confirmed';
  }

  /**
   * Vérifie si un paiement est en attente
   */
  async isPaymentPending(saleId) {
    const result = await this.checkPaymentStatus(saleId);
    return result.status === 'pending';
  }

  /**
   * Vérifie si un paiement a échoué
   */
  async isPaymentFailed(saleId) {
    const result = await this.checkPaymentStatus(saleId);
    return result.status === 'failed';
  }

  /**
   * Récupère les détails de la facture
   */
  async getInvoiceDetails(saleId) {
    const result = await this.checkPaymentStatus(saleId);
    if (!result.success) {
      return null;
    }

    return {
      invoiceUrl: result.invoiceUrl,
      invoiceNumber: result.invoiceNumber,
      paidAt: result.paidAt,
    };
  }

  /**
   * Convertit le statut en texte lisible
   */
  statusToText(status) {
    const statusMap = {
      pending: 'En attente',
      confirmed: 'Confirmé',
      failed: 'Échoué',
      expired: 'Expiré',
      unknown: 'Inconnu',
    };
    return statusMap[status] || status;
  }

  /**
   * Détermine si un statut est final
   */
  isFinalStatus(status) {
    return ['confirmed', 'failed', 'expired'].includes(status);
  }
}

// ═══════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════

let paymentStatusManagerInstance = null;

export function getPaymentStatusManager() {
  if (!paymentStatusManagerInstance) {
    paymentStatusManagerInstance = new PaymentStatusManager();
  }
  return paymentStatusManagerInstance;
}

export default PaymentStatusManager;
