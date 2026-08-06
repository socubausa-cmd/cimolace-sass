import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsISO31661Alpha3,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Achat par carte (Stripe Checkout). Le prix vient de la BASE, jamais du client. */
export class BuyStripeDto {
  @IsEmail() @MaxLength(200)
  buyerEmail: string;

  @IsOptional() @IsString() @Length(1, 80)
  buyerName?: string;
}

/** Achat par Mobile Money (pawaPay). */
export class BuyPawapayDto {
  @IsEmail() @MaxLength(200)
  buyerEmail: string;

  @IsOptional() @IsString() @Length(1, 80)
  buyerName?: string;

  @IsString() @Matches(/^\+?[0-9 ]{7,20}$/, { message: 'Numéro Mobile Money invalide.' })
  phoneNumber: string;

  /** Opérateur (ex. 'AIRTEL_GAB') — voir GET /boutique/produits/:slug/providers. */
  @IsString() @Length(3, 64)
  provider: string;

  @IsISO31661Alpha3()
  country: string;
}

export class ConfirmStripeDto {
  @IsString() @Length(1, 200)
  sessionId: string;
}

/** Renvoi du lien de téléchargement à l'acheteuse qui a perdu son e-mail. */
export class ResendLinkDto {
  @IsEmail() @MaxLength(200)
  email: string;
}

/** Dépôt d'un avis — publié seulement après modération. */
export class SubmitReviewDto {
  @IsString() @Length(2, 80)
  authorName: string;

  @IsOptional() @IsString() @Length(1, 80)
  authorRole?: string;

  @IsInt() @Min(1) @Max(5)
  rating: number;

  @IsString() @Length(10, 2000)
  reviewText: string;

  /** Sert UNIQUEMENT à rapprocher l'avis d'une commande (badge « achat vérifié »). */
  @IsOptional() @IsEmail() @MaxLength(200)
  buyerEmail?: string;

  /** Champ piège anti-robot : rempli ⇒ requête ignorée silencieusement. */
  @IsOptional() @IsString() @MaxLength(120)
  website?: string;
}

/** Avancement d'une demande dans le pipeline (back-office). */
export class UpdateRequestDto {
  @IsIn(['nouvelle', 'contactee', 'planifiee', 'terminee', 'annulee'])
  status: string;
}

/** Demande de rendez-vous pour l'accompagnement. */
export class AccompanimentRequestDto {
  @IsOptional() @IsString() @Length(1, 40)
  formulaKey?: string;

  @IsString() @Length(2, 120)
  fullName: string;

  @IsEmail() @MaxLength(200)
  email: string;

  @IsOptional() @IsString() @Matches(/^\+?[0-9 ().-]{6,25}$/, { message: 'Numéro invalide.' })
  phone?: string;

  @IsOptional() @IsString() @Length(2, 60)
  country?: string;

  @IsOptional() @IsISO8601()
  preferredAt?: string;

  @IsOptional() @IsString() @Length(1, 120)
  preferredNote?: string;

  @IsOptional() @IsIn(['visio', 'telephone', 'whatsapp', 'presentiel'])
  channel?: string;

  @IsOptional() @IsString() @Length(1, 2000)
  message?: string;

  @IsBoolean()
  consent: boolean;

  @IsOptional() @IsString() @MaxLength(120)
  website?: string;
}
