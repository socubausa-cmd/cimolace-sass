-- ============================================================================
-- Mbolo — Vague 1 : enrichissement du catalogue (base Cimolace)
-- ----------------------------------------------------------------------------
-- ADDITIF uniquement : nouvelles tables mbolo_* + colonnes sur mbolo_products.
-- Ne touche AUCUNE table existante (MEDOS, products legacy…).
-- Pattern Cimolace : tenant_id + RLS activé sans policy (accès via backend
-- service-role qui filtre par tenant_id ; pas de is_tenant_member ici).
-- Appliqué via l'API management (pas `db push` — drift de migrations).
-- ============================================================================

begin;

-- ─── mbolo_categories (nouveau) ─────────────────────────────────────────────
create table if not exists public.mbolo_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  slug text not null,
  name text not null,
  description text,
  image_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);
create index if not exists idx_mbolo_categories_tenant on public.mbolo_categories(tenant_id);
alter table public.mbolo_categories enable row level security;

-- ─── mbolo_products : enrichissement (ADD COLUMN additif) ───────────────────
alter table public.mbolo_products add column if not exists slug text;
alter table public.mbolo_products add column if not exists sku text;
alter table public.mbolo_products add column if not exists category_id uuid references public.mbolo_categories(id) on delete set null;
alter table public.mbolo_products add column if not exists compare_at_price_cents int;
alter table public.mbolo_products add column if not exists currency text not null default 'XAF';
alter table public.mbolo_products add column if not exists stock int not null default 0;
alter table public.mbolo_products add column if not exists is_featured boolean not null default false;
alter table public.mbolo_products add column if not exists tagline text;
alter table public.mbolo_products add column if not exists benefits jsonb not null default '[]'::jsonb;
alter table public.mbolo_products add column if not exists ingredients jsonb not null default '[]'::jsonb;
alter table public.mbolo_products add column if not exists seo_title text;
alter table public.mbolo_products add column if not exists seo_description text;
alter table public.mbolo_products add column if not exists updated_at timestamptz not null default now();

create unique index if not exists mbolo_products_tenant_slug_key on public.mbolo_products(tenant_id, slug) where slug is not null;
create unique index if not exists mbolo_products_tenant_sku_key  on public.mbolo_products(tenant_id, sku)  where sku  is not null;
create index if not exists idx_mbolo_products_category on public.mbolo_products(category_id);

-- ─── mbolo_product_images (nouveau) ─────────────────────────────────────────
create table if not exists public.mbolo_product_images (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  product_id uuid not null references public.mbolo_products(id) on delete cascade,
  url text not null,
  alt text,
  sort_order int not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_mbolo_product_images_product on public.mbolo_product_images(product_id, sort_order);
alter table public.mbolo_product_images enable row level security;

-- ─── mbolo_product_variants (nouveau) ───────────────────────────────────────
create table if not exists public.mbolo_product_variants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  product_id uuid not null references public.mbolo_products(id) on delete cascade,
  label text not null,
  sku_suffix text,
  price_delta_cents int not null default 0,
  stock int not null default 0,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_mbolo_product_variants_product on public.mbolo_product_variants(product_id);
alter table public.mbolo_product_variants enable row level security;

commit;
