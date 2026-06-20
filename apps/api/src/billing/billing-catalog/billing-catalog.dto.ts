import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

/**
 * Catégories de services proposés au catalogue d'un tenant.
 * Doit rester aligné sur les valeurs métier de `billing_plans.category`.
 */
export const CATALOG_CATEGORIES = [
  'cycle',
  'temple',
  'consultation',
  'mentorat',
  'custom',
] as const;

export type CatalogCategory = (typeof CATALOG_CATEGORIES)[number];

/**
 * Cycles de facturation acceptés.
 * Doit rester aligné sur le CHECK SQL `billing_plans.billing_cycle`.
 */
export const BILLING_CYCLES = [
  'monthly',
  'one_time',
  'yearly',
  'quarterly',
  'weekly',
] as const;

export type BillingCycle = (typeof BILLING_CYCLES)[number];

/**
 * Modèle d'accès d'un service :
 *   paid = payant (checkout) · free = gratuit (accès direct) · community = communauté (adhésion gratuite).
 * Doit rester aligné sur `billing_plans.access_model`.
 */
export const ACCESS_MODELS = ['paid', 'free', 'community'] as const;

export type AccessModel = (typeof ACCESS_MODELS)[number];

/**
 * Body de POST /billing/catalog — création d'un service au catalogue du tenant.
 * `key` n'est PAS accepté ici : il est dérivé du label (slugify + suffixe court)
 * côté service pour garantir l'unicité tenant-scopée.
 */
export class CreateCatalogServiceDto {
  @IsIn(CATALOG_CATEGORIES)
  category!: CatalogCategory;

  @IsString()
  @Length(1, 200)
  label!: string;

  @IsOptional()
  @IsString()
  tagline?: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Prix en centimes (jamais en flottant) : entier >= 0.
  @IsInt()
  @Min(0)
  priceCents!: number;

  // Code devise ISO 4217 (3 lettres), ex. EUR, XAF.
  @IsString()
  @Length(3, 3)
  currency!: string;

  @IsIn(BILLING_CYCLES)
  billingCycle!: BillingCycle;

  // Modèle d'accès : payant (checkout) / gratuit / communauté. Défaut serveur = 'paid'.
  @IsOptional()
  @IsIn(ACCESS_MODELS)
  accessModel?: AccessModel;

  // Ordre d'affichage dans le catalogue (croissant).
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  // Liste libre de bénéfices/features affichés sur la carte.
  @IsOptional()
  @IsArray()
  features?: any[];

  // Métadonnées libres (jsonb), ex. couleur, icône, flags internes.
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

/**
 * Body de PATCH /billing/catalog/:key — mise à jour partielle.
 * Tous les champs sont optionnels ; `key` reste immuable (clé de l'URL).
 */
export class UpdateCatalogServiceDto {
  @IsOptional()
  @IsIn(CATALOG_CATEGORIES)
  category?: CatalogCategory;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  label?: string;

  @IsOptional()
  @IsString()
  tagline?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsIn(BILLING_CYCLES)
  billingCycle?: BillingCycle;

  @IsOptional()
  @IsIn(ACCESS_MODELS)
  accessModel?: AccessModel;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  features?: any[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
