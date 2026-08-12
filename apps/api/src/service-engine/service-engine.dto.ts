import {
  ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional,
  IsString, IsUUID, Length, Max, Min,
} from 'class-validator';

/** §6 — un service peut être hybride, d'où un tableau et non une valeur. */
export const DELIVERY_MODES = ['liri', 'on_site', 'home', 'event'] as const;

/**
 * Sert à la CRÉATION comme à la MISE À JOUR, d'où `nameFr` facultatif ici :
 * un PATCH qui ne change que la publication n'a pas à renvoyer le nom.
 * La présence du nom à la création est vérifiée dans le service — un DTO
 * strict rejetait `{ isPublic: true }` en 400, ce qui rendait la publication
 * impossible (constaté au test de bout en bout).
 */
export class UpsertServiceDto {
  @IsOptional() @IsString() @Length(1, 120)
  slug?: string;

  @IsOptional() @IsString() @Length(1, 200)
  nameFr?: string;

  @IsOptional() @IsString() @Length(1, 200)
  nameEn?: string;

  @IsOptional() @IsString() @Length(0, 400)
  descriptionFr?: string;

  @IsOptional() @IsString() @Length(0, 5000)
  fullDescription?: string;

  @IsOptional() @IsUUID()
  categoryId?: string;

  // ── Délivrance ────────────────────────────────────────────────────────────
  @IsOptional() @IsArray() @ArrayUnique() @IsIn(DELIVERY_MODES as unknown as string[], { each: true })
  deliveryModes?: string[];

  @IsOptional() @IsString() @Length(1, 60)
  liriEnvironment?: string;

  // ── Tarification ──────────────────────────────────────────────────────────
  @IsOptional() @IsNumber() @Min(0)
  priceEur?: number;

  @IsOptional() @IsInt() @Min(0)
  priceXaf?: number;

  @IsOptional() @IsNumber() @Min(0) @Max(100)
  taxPercent?: number;

  @IsOptional() @IsBoolean()
  isQuoteOnly?: boolean;

  // ── Durée et rythme ───────────────────────────────────────────────────────
  @IsOptional() @IsInt() @Min(1) @Max(1440)
  durationMinutes?: number;

  @IsOptional() @IsInt() @Min(0) @Max(480)
  prepMinutes?: number;

  @IsOptional() @IsInt() @Min(0) @Max(480)
  bufferMinutes?: number;

  // ── Capacité ──────────────────────────────────────────────────────────────
  @IsOptional() @IsBoolean()
  isGroup?: boolean;

  @IsOptional() @IsInt() @Min(1) @Max(10000)
  capacity?: number;

  // ── Règles ────────────────────────────────────────────────────────────────
  @IsOptional() @IsBoolean()
  requiresBooking?: boolean;

  @IsOptional() @IsBoolean()
  requiresPayment?: boolean;

  @IsOptional() @IsBoolean()
  depositEnabled?: boolean;

  @IsOptional() @IsInt() @Min(0)
  depositCents?: number;

  @IsOptional() @IsInt() @Min(1) @Max(100)
  depositPercent?: number;

  @IsOptional() @IsInt() @Min(0) @Max(8760)
  cancellationHours?: number;

  @IsOptional() @IsString() @Length(0, 2000)
  refundPolicy?: string;

  @IsOptional() @IsString() @Length(0, 5000)
  terms?: string;

  // ── Domicile (§9) ─────────────────────────────────────────────────────────
  @IsOptional() @IsBoolean()
  travelEnabled?: boolean;

  @IsOptional() @IsInt() @Min(0)
  travelFeeCents?: number;

  @IsOptional() @IsInt() @Min(1) @Max(500)
  travelRadiusKm?: number;

  // ── Bornes de réservation (§7) ────────────────────────────────────────────
  @IsOptional() @IsInt() @Min(0) @Max(8760)
  minNoticeHours?: number;

  @IsOptional() @IsInt() @Min(1) @Max(730)
  maxAdvanceDays?: number;

  // ── Publication ───────────────────────────────────────────────────────────
  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @IsBoolean()
  isPublic?: boolean;

  @IsOptional() @IsInt()
  sortOrder?: number;

  @IsOptional() @IsString()
  image?: string;

  @IsOptional() @IsArray()
  questionnaire?: unknown[];

  @IsOptional() @IsArray()
  requiredDocuments?: unknown[];
}

export class UpsertCategoryDto {
  @IsString() @Length(1, 120)
  name: string;

  @IsOptional() @IsString() @Length(1, 120)
  slug?: string;

  @IsOptional() @IsString() @Length(0, 1000)
  description?: string;

  @IsOptional() @IsUUID()
  parentId?: string;

  @IsOptional() @IsString()
  icon?: string;

  @IsOptional() @IsInt()
  sortOrder?: number;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
