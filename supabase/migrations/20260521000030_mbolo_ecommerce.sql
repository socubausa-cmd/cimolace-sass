-- ============================================================================
-- Migration: Tables e-commerce Mbolo
-- Date: 2026-05-21
--
-- Objectif:
-- Créer les tables du module Mbolo (boutique en ligne multi-tenant) :
--   - mbolo_products  : catalogue produits
--   - mbolo_cart_items: panier utilisateur (éphémère)
--   - mbolo_orders    : commandes passées
--   - mbolo_order_items: lignes de commande
-- ============================================================================

-- ── mbolo_products ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mbolo_products (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  name            TEXT          NOT NULL,
  slug            TEXT          NOT NULL,
  description     TEXT,
  short_desc      TEXT,

  price           NUMERIC(12,2) NOT NULL DEFAULT 0,
  compare_price   NUMERIC(12,2),               -- prix barré
  currency        TEXT          NOT NULL DEFAULT 'USD',

  sku             TEXT,
  stock           INT           NOT NULL DEFAULT 0,
  track_stock     BOOLEAN       NOT NULL DEFAULT true,
  unlimited_stock BOOLEAN       NOT NULL DEFAULT false,

  product_type    TEXT          NOT NULL DEFAULT 'physical'
                                CHECK (product_type IN ('physical', 'digital', 'service', 'subscription')),
  status          TEXT          NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft', 'active', 'archived')),

  images          JSONB         NOT NULL DEFAULT '[]',
  metadata        JSONB         NOT NULL DEFAULT '{}',

  created_by      UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_mbolo_products_tenant
  ON mbolo_products(tenant_id);

CREATE INDEX IF NOT EXISTS idx_mbolo_products_status
  ON mbolo_products(tenant_id, status)
  WHERE status = 'active';

DROP TRIGGER IF EXISTS mbolo_products_updated_at ON mbolo_products;
CREATE TRIGGER mbolo_products_updated_at
  BEFORE UPDATE ON mbolo_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── mbolo_cart_items ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mbolo_cart_items (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id      UUID          NOT NULL REFERENCES mbolo_products(id) ON DELETE CASCADE,

  quantity        INT           NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price      NUMERIC(12,2) NOT NULL,        -- snapshot prix au moment de l'ajout
  metadata        JSONB         NOT NULL DEFAULT '{}',

  added_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_mbolo_cart_user
  ON mbolo_cart_items(tenant_id, user_id);

DROP TRIGGER IF EXISTS mbolo_cart_updated_at ON mbolo_cart_items;
CREATE TRIGGER mbolo_cart_updated_at
  BEFORE UPDATE ON mbolo_cart_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── mbolo_orders ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mbolo_orders (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id             UUID          REFERENCES auth.users(id) ON DELETE SET NULL,

  order_number        TEXT          NOT NULL UNIQUE,  -- ex: ORD-2026-000001
  status              TEXT          NOT NULL DEFAULT 'pending'
                                    CHECK (status IN (
                                      'pending', 'confirmed', 'processing',
                                      'shipped', 'delivered', 'cancelled', 'refunded'
                                    )),
  payment_status      TEXT          NOT NULL DEFAULT 'unpaid'
                                    CHECK (payment_status IN ('unpaid', 'paid', 'partial', 'refunded')),

  subtotal            NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total               NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency            TEXT          NOT NULL DEFAULT 'USD',

  shipping_address    JSONB         NOT NULL DEFAULT '{}',
  billing_address     JSONB         NOT NULL DEFAULT '{}',

  payment_tx_id       UUID          REFERENCES payment_transactions(id) ON DELETE SET NULL,
  notes               TEXT,
  metadata            JSONB         NOT NULL DEFAULT '{}',

  confirmed_at        TIMESTAMPTZ,
  shipped_at          TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,

  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mbolo_orders_tenant
  ON mbolo_orders(tenant_id);

CREATE INDEX IF NOT EXISTS idx_mbolo_orders_user
  ON mbolo_orders(user_id);

CREATE INDEX IF NOT EXISTS idx_mbolo_orders_status
  ON mbolo_orders(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_mbolo_orders_number
  ON mbolo_orders(order_number);

DROP TRIGGER IF EXISTS mbolo_orders_updated_at ON mbolo_orders;
CREATE TRIGGER mbolo_orders_updated_at
  BEFORE UPDATE ON mbolo_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── mbolo_order_items ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mbolo_order_items (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID          NOT NULL REFERENCES mbolo_orders(id) ON DELETE CASCADE,
  product_id      UUID          REFERENCES mbolo_products(id) ON DELETE SET NULL,

  product_name    TEXT          NOT NULL,       -- snapshot nom au moment de la commande
  product_sku     TEXT,
  quantity        INT           NOT NULL CHECK (quantity > 0),
  unit_price      NUMERIC(12,2) NOT NULL,
  total_price     NUMERIC(12,2) NOT NULL,
  metadata        JSONB         NOT NULL DEFAULT '{}',

  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mbolo_order_items_order
  ON mbolo_order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_mbolo_order_items_product
  ON mbolo_order_items(product_id)
  WHERE product_id IS NOT NULL;

-- ── RLS : mbolo_products ──────────────────────────────────────────────────

ALTER TABLE mbolo_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_active_products" ON mbolo_products;
CREATE POLICY "public_read_active_products"
  ON mbolo_products FOR SELECT TO authenticated
  USING (status = 'active');

DROP POLICY IF EXISTS "tenant_admin_manage_products" ON mbolo_products;
CREATE POLICY "tenant_admin_manage_products"
  ON mbolo_products FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.tenant_id = mbolo_products.tenant_id
        AND tm.user_id   = auth.uid()
        AND tm.role      IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.tenant_id = mbolo_products.tenant_id
        AND tm.user_id   = auth.uid()
        AND tm.role      IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "service_role_products" ON mbolo_products;
CREATE POLICY "service_role_products"
  ON mbolo_products FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── RLS : mbolo_cart_items ────────────────────────────────────────────────

ALTER TABLE mbolo_cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_manage_own_cart" ON mbolo_cart_items;
CREATE POLICY "user_manage_own_cart"
  ON mbolo_cart_items FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "service_role_cart" ON mbolo_cart_items;
CREATE POLICY "service_role_cart"
  ON mbolo_cart_items FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── RLS : mbolo_orders ────────────────────────────────────────────────────

ALTER TABLE mbolo_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_read_own_orders" ON mbolo_orders;
CREATE POLICY "user_read_own_orders"
  ON mbolo_orders FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "tenant_admin_read_orders" ON mbolo_orders;
CREATE POLICY "tenant_admin_read_orders"
  ON mbolo_orders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.tenant_id = mbolo_orders.tenant_id
        AND tm.user_id   = auth.uid()
        AND tm.role      IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "service_role_orders" ON mbolo_orders;
CREATE POLICY "service_role_orders"
  ON mbolo_orders FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── RLS : mbolo_order_items ───────────────────────────────────────────────

ALTER TABLE mbolo_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_read_own_order_items" ON mbolo_order_items;
CREATE POLICY "user_read_own_order_items"
  ON mbolo_order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mbolo_orders o
      WHERE o.id = mbolo_order_items.order_id
        AND o.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "service_role_order_items" ON mbolo_order_items;
CREATE POLICY "service_role_order_items"
  ON mbolo_order_items FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE mbolo_products   IS 'Catalogue produits du module e-commerce Mbolo (multi-tenant).';
COMMENT ON TABLE mbolo_cart_items IS 'Paniers utilisateurs Mbolo — éphémères, nettoyés après commande.';
COMMENT ON TABLE mbolo_orders     IS 'Commandes Mbolo avec statut paiement et livraison.';
COMMENT ON TABLE mbolo_order_items IS 'Lignes de commande Mbolo — snapshot produit au moment de l''achat.';
