import {
  IsIn,
  IsInt,
  IsISO31661Alpha3,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';

/**
 * Dépôt Mobile Money (pawaPay) pour une offre PRORASCIENCE / Ngowazulu :
 * - subscription : abonnement mensuel mentorat (montant lu serveur via planSlug)
 * - consultation : consultation 90 min (montant fourni)
 * - donation     : offrande libre (montant fourni)
 */
export class CreateOfferingDepositDto {
  @IsIn(['subscription', 'consultation', 'donation'])
  kind: 'subscription' | 'consultation' | 'donation';

  /** Slug d'offre mentorat (ex: 'ngowazulu-mentorat-1x-week'). Requis si kind=subscription. */
  @IsOptional()
  @IsString()
  @Length(3, 80)
  planSlug?: string;

  /** Montant en centimes — requis pour consultation/donation (jamais utilisé pour un abonnement). */
  @IsOptional()
  @IsInt()
  @Min(100)
  amountCents?: number;

  /** Numéro Mobile Money au format E.164 (ex: '+237612345678'). */
  @IsString()
  @Matches(/^\+?[1-9]\d{6,14}$/, {
    message: 'phoneNumber doit être au format international E.164 (ex: +237612345678)',
  })
  phoneNumber: string;

  /** Opérateur Mobile Money (ex: 'MTN_MOMO_CMR', 'ORANGE_CMR'). Voir GET /offering-checkout/providers. */
  @IsString()
  @Length(3, 64)
  provider: string;

  /** Pays ISO 3166-1 alpha-3 (ex: 'CMR', 'CIV', 'RWA'). */
  @IsISO31661Alpha3()
  country: string;
}
