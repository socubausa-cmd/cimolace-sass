/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE PAYMENT PRODUCTS - GESTION DES PRODUITS DE PAIEMENT
 * ═══════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════
// PRODUITS PAR DÉFAUT
// ═══════════════════════════════════════════════════════════════

const DEFAULT_PRODUCTS = {
  setup: {
    id: 'setup',
    name: 'Configuration Virtuel-Mbolo',
    description: 'Frais de configuration initiale pour votre site Virtuel-Mbolo',
    price: 500,
    currency: 'EUR',
    type: 'one_time',
    provider: 'chariow',
    providerProductId: process.env.CHARIOW_PRODUCT_SETUP,
  },
  Start: {
    id: 'Start',
    name: 'Virtuel-Mbolo Starter',
    description: 'Abonnement mensuel plan Starter',
    price: 150,
    currency: 'EUR',
    type: 'monthly_manual',
    provider: 'chariow',
    providerProductId: process.env.CHARIOW_PRODUCT_START,
  },
  Business: {
    id: 'Business',
    name: 'Virtuel-Mbolo Pro',
    description: 'Abonnement mensuel plan Pro',
    price: 200,
    currency: 'EUR',
    type: 'monthly_manual',
    provider: 'chariow',
    providerProductId: process.env.CHARIOW_PRODUCT_BUSINESS,
  },
  Entreprise: {
    id: 'Entreprise',
    name: 'Virtuel-Mbolo Elite',
    description: 'Abonnement mensuel plan Elite',
    price: 300,
    currency: 'EUR',
    type: 'monthly_manual',
    provider: 'chariow',
    providerProductId: process.env.CHARIOW_PRODUCT_ENTREPRISE,
  },
};

// ═══════════════════════════════════════════════════════════════
// CLASS PRODUCT MANAGER
// ═══════════════════════════════════════════════════════════════

class ProductManager {
  constructor() {
    this.products = { ...DEFAULT_PRODUCTS };
  }

  /**
   * Récupère tous les produits
   */
  getAllProducts() {
    return Object.values(this.products);
  }

  /**
   * Récupère un produit par ID
   */
  getProductById(productId) {
    return this.products[productId] || null;
  }

  /**
   * Récupère un produit par plan (starter, pro, elite)
   */
  getProductByPlan(plan) {
    const productId = `virtuel_mbolo_${plan}`;
    return this.getProductById(productId);
  }

  /**
   * Récupère le produit de setup
   */
  getSetupProduct() {
    return this.getProductById('virtuel_mbolo_setup');
  }

  /**
   * Ajoute ou met à jour un produit
   */
  upsertProduct(product) {
    this.products[product.id] = product;
    return this.products[product.id];
  }

  /**
   * Supprime un produit
   */
  deleteProduct(productId) {
    const product = this.products[productId];
    delete this.products[productId];
    return product;
  }

  /**
   * Récupère les produits par type
   */
  getProductsByType(type) {
    return Object.values(this.products).filter(p => p.type === type);
  }

  /**
   * Récupère les produits mensuels
   */
  getMonthlyProducts() {
    return this.getProductsByType('monthly_manual');
  }

  /**
   * Récupère les produits one-time
   */
  getOneTimeProducts() {
    return this.getProductsByType('one_time');
  }
}

// ═══════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════

let productManagerInstance = null;

export function getProductManager() {
  if (!productManagerInstance) {
    productManagerInstance = new ProductManager();
  }
  return productManagerInstance;
}

export default ProductManager;
