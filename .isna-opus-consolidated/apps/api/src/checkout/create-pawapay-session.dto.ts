import { IsISO31661Alpha3, IsPhoneNumber, IsString, IsUUID, Length, Matches } from 'class-validator';

export class CreatePawaPaySessionDto {
  @IsUUID()
  liveSessionId: string;

  /**
   * Numéro de téléphone Mobile Money au format international (ex: "+237612345678").
   * pawaPay exige le format E.164.
   */
  @IsString()
  @Matches(/^\+?[1-9]\d{6,14}$/, {
    message:
      'phoneNumber doit être au format international E.164 (ex: +237612345678)',
  })
  phoneNumber: string;

  /**
   * Code du provider Mobile Money (ex: "MTN_MOMO_CMR", "ORANGE_CMR", "MTN_MOMO_RWA").
   * Récupérer la liste via GET /checkout/pawapay/providers?country=CMR.
   */
  @IsString()
  @Length(3, 64)
  provider: string;

  /**
   * Code pays ISO 3166-1 alpha-3 (ex: "CMR", "RWA", "GHA", "CIV").
   */
  @IsISO31661Alpha3()
  country: string;
}
