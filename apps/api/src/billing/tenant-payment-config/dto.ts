import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

/**
 * Agrégateurs supportés par le moteur de config des moyens de paiement.
 * Doit rester aligné sur le CHECK SQL `tenant_payment_providers_provider_check`.
 */
export const PAYMENT_PROVIDERS = [
  'stripe',
  'pawapay',
  'chariow',
  'paypal',
  'cinetpay',
] as const;

export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

/**
 * Body de POST /billing/payment-methods — upsert d'un provider.
 * `credentials` arrive EN CLAIR (chiffré côté service avant stockage).
 */
export class UpsertPaymentMethodDto {
  @IsIn(PAYMENT_PROVIDERS)
  provider!: PaymentProvider;

  @IsOptional()
  @IsString()
  mode?: string;

  // Secrets en clair, forme variable selon le provider :
  //  stripe  → { secret_key, webhook_secret }
  //  pawapay → { api_token, signing_secret }
  //  chariow → { api_key, webhook_secret }
  // Validé comme objet ; le service ne retient que les clés string non vides.
  @IsObject()
  credentials!: Record<string, string>;

  // Chariow uniquement : mapping plan → product ID.
  @IsOptional()
  @IsObject()
  productMap?: Record<string, string>;
}

/** Body de PATCH /billing/payment-methods/:provider — activer/désactiver. */
export class TogglePaymentMethodDto {
  @IsBoolean()
  enabled!: boolean;
}
