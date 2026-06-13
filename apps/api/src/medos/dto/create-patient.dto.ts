import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreatePatientDto {
  /**
   * Optionnel depuis 2026-06 : si absent, l'API provisionne (ou retrouve) le
   * compte patient à partir de `email` — c'est ce que fait le modal
   * "Nouveau patient" et le wizard Onboarding Twin qui n'ont pas d'UUID sous
   * la main. Si fourni, on lie directement à ce user existant.
   */
  @IsOptional()
  @IsUUID()
  patient_user_id?: string;

  /**
   * Requis SEULEMENT si `patient_user_id` est absent. Sert à créer/retrouver
   * le compte Supabase du patient + son membership tenant (rôle patient).
   */
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(1)
  first_name: string;

  @IsString()
  @MinLength(1)
  last_name: string;

  @IsOptional()
  @IsDateString()
  date_of_birth?: string;

  @IsOptional()
  @IsIn(['male', 'female', 'other', 'prefer_not_to_say'])
  gender?: string;

  @IsOptional()
  @IsString()
  blood_type?: string;

  @IsOptional()
  @IsArray()
  allergies?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  chronic_conditions?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  current_medications?: Record<string, unknown>[];

  @IsOptional()
  @IsObject()
  medical_history?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  family_history?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  emergency_contact?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  insurance_info?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  consent_given?: boolean;

  @IsOptional()
  @IsString()
  consent_purpose?: string;
}
