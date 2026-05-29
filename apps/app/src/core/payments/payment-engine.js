/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE PAYMENT ENGINE - MOTEUR DE PAIEMENT GÉNÉRIQUE
 * Basé sur le moteur Chariow existant du projet
 * ═══════════════════════════════════════════════════════════════
 */

import {
  chariowCreateCheckout,
  chariowGetSale,
  chariowGetProduct,
  normalizeChariowPhone,
  mapChariowStatus,
  parseChariowProductMapping,
  isChariowProductLikelyCheckoutCompatible,
  extractChariowLicenseInfo,
  extractChariowInvoiceInfo,
} from '../../../netlify/functions/_lib/payments/chariow.js';

// ═══════════════════════════════════════════════════════════════
// PAYMENT ENGINE CLASS
// ═══════════════════════════════════════════════════════════════

class PaymentEngine {
  constructor(apiKey, apiUrl) {
    this.apiKey = apiKey;
    this.apiUrl = apiUrl || 'https://api.chariow.com/v1';
  }

  /**
   * Crée un checkout pour un produit
   */
  async createCheckout(request) {
    try {
      const firstName = request.customerName.split(' ')[0] || 'Client';
      const lastName = request.customerName.split(' ').slice(1).join(' ') || 'CIMOLACE';

      const normalizedPhone = normalizeChariowPhone({
        rawNumber: request.customerPhone,
        rawCountryCode: request.phoneCountryCode,
      });

      if (!normalizedPhone.isValid) {
        throw new Error('Numéro de téléphone invalide');
      }

      const result = await chariowCreateCheckout({
        apiKey: this.apiKey,
        productId: request.productId,
        email: request.customerEmail,
        firstName,
        lastName,
        phoneNumber: request.customerPhone,
        phoneCountryCode: request.phoneCountryCode,
        redirectUrl: request.redirectUrl,
        customMetadata: request.customMetadata,
        currency: request.currency || 'EUR',
      });

      return {
        success: true,
        checkoutUrl: result?.payment?.checkout_url,
        saleId: result?.purchase?.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Erreur lors de la création du checkout',
      };
    }
  }

  /**
   * Récupère le statut d'un paiement
   */
  async getPaymentStatus(saleId) {
    try {
      const sale = await chariowGetSale({ apiKey: this.apiKey, saleId });
      const status = mapChariowStatus(sale);
      const invoiceInfo = extractChariowInvoiceInfo(sale);

      return {
        status,
        paidAt: sale?.payment?.paid_at || sale?.paid_at,
        invoiceUrl: invoiceInfo.providerInvoiceUrl,
        invoiceNumber: invoiceInfo.providerInvoiceNumber,
      };
    } catch (error) {
      throw new Error(`Erreur récupération statut: ${error.message || 'Erreur inconnue'}`);
    }
  }

  /**
   * Récupère les informations d'un produit
   */
  async getProduct(productId) {
    try {
      const product = await chariowGetProduct({ apiKey: this.apiKey, productId });
      return product;
    } catch (error) {
      throw new Error(`Erreur récupération produit: ${error.message || 'Erreur inconnue'}`);
    }
  }

  /**
   * Vérifie si un produit est compatible checkout
   */
  isProductCheckoutCompatible(product) {
    return isChariowProductLikelyCheckoutCompatible(product);
  }

  /**
   * Parse un mapping de produit Chariow
   */
  parseProductMapping(rawValue) {
    return parseChariowProductMapping(rawValue);
  }
}

// ═══════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════

let paymentEngineInstance = null;

export function getPaymentEngine() {
  if (!paymentEngineInstance) {
    const apiKey = process.env.CHARIOW_API_KEY;
    const apiUrl = process.env.CHARIOW_API_URL;
    if (!apiKey) {
      throw new Error('CHARIOW_API_KEY non défini');
    }
    paymentEngineInstance = new PaymentEngine(apiKey, apiUrl);
  }
  return paymentEngineInstance;
}

export default PaymentEngine;
