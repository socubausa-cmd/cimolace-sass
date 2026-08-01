import {
  IsInt, IsOptional, IsString, Length, Min, Max, Matches, IsISO31661Alpha3,
} from 'class-validator';

export class CreateCagnotteStripeDto {
  @IsInt() @Min(100) @Max(500000)
  amountCents: number;

  @IsOptional() @IsString() @Length(1, 80)
  donorName?: string;

  @IsOptional() @IsString() @Length(1, 300)
  donorMessage?: string;
}

export class CreateCagnottePawapayDto {
  @IsInt() @Min(100) @Max(500000)
  amountCents: number;

  /** Numéro Mobile Money (E.164 ou local ; nettoyé côté serveur). */
  @IsString() @Matches(/^\+?[0-9 ]{7,20}$/, { message: 'Numéro Mobile Money invalide.' })
  phoneNumber: string;

  /** Opérateur (ex: 'MTN_MOMO_CMR', 'ORANGE_CMR') — voir GET /cagnotte/:slug/providers. */
  @IsString() @Length(3, 64)
  provider: string;

  /** Pays ISO 3166-1 alpha-3 (ex: 'CMR', 'CIV'). Détermine XAF vs XOF. */
  @IsISO31661Alpha3()
  country: string;

  @IsOptional() @IsString() @Length(1, 80)
  donorName?: string;

  @IsOptional() @IsString() @Length(1, 300)
  donorMessage?: string;
}

export class ConfirmStripeDto {
  @IsString() @Length(1, 200)
  sessionId: string;
}
