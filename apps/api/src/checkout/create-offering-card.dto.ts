import { IsIn, IsInt, IsOptional, IsString, IsUrl, Length, Matches, Min } from 'class-validator';

/**
 * Paiement CARTE (Stripe Checkout) pour une offre PRORASCIENCE / Ngowazulu :
 * - subscription : abonnement mensuel mentorat → Stripe mode 'subscription' (débit auto)
 * - consultation : consultation 90 min → Stripe mode 'payment' (one-off)
 * - donation     : offrande libre → Stripe mode 'payment' (one-off)
 *
 * Le montant d'un abonnement est TOUJOURS recalculé serveur via planSlug (jamais le client).
 */
export class CreateOfferingCardDto {
  @IsIn(['subscription', 'consultation', 'donation'])
  kind: 'subscription' | 'consultation' | 'donation';

  /** Slug d'offre mentorat (ex: 'ngowazulu-mentorat-1x-week'). Requis si kind=subscription. */
  @IsOptional()
  @IsString()
  @Length(3, 80)
  planSlug?: string;

  /** Montant en centimes — requis pour consultation/donation (ignoré pour un abonnement). */
  @IsOptional()
  @IsInt()
  @Min(100)
  amountCents?: number;

  /** URL de retour succès (Stripe ajoute ?session_id=...). Optionnel — fallback serveur sinon. */
  @IsOptional()
  @IsUrl({ require_tld: false })
  successUrl?: string;

  /** URL de retour annulation. Optionnel — fallback serveur sinon. */
  @IsOptional()
  @IsUrl({ require_tld: false })
  cancelUrl?: string;

  /**
   * Slug du tenant qui ENCAISSE. Défaut serveur : 'isna' (rétrocompatible).
   * Permet à un AUTRE tenant de vendre via ce moteur (sa propre clé Stripe +
   * ses URLs de retour /t/:slug/paiement).
   */
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'tenantSlug invalide (minuscules, chiffres, tirets)',
  })
  @Length(2, 64)
  tenantSlug?: string;
}
