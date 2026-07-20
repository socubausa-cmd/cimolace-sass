import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateInvitationDto {
  @ApiProperty()
  @IsUUID()
  patient_id!: string;

  @ApiPropertyOptional({ description: 'Email du patient (au moins 1 canal requis)' })
  @IsOptional()
  @IsEmail()
  invited_email?: string;

  @ApiPropertyOptional({ description: 'Téléphone (au moins 1 canal requis)' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  invited_phone?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  invited_name!: string;

  @ApiPropertyOptional({ default: 7, minimum: 1, maximum: 90 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  expires_in_days?: number;

  @ApiPropertyOptional({ enum: ['email', 'sms', 'whatsapp', 'manual'] })
  @IsOptional()
  @IsEnum(['email', 'sms', 'whatsapp', 'manual'])
  sent_via?: 'email' | 'sms' | 'whatsapp' | 'manual';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  custom_message?: string;

  /**
   * G2 — Formulaires à assigner automatiquement au patient dès qu'il accepte
   * l'invitation. Chaque UUID doit référencer un `med_medical_forms.id`
   * (template tenant OU template global). Les assignations sont créées avec
   * `assigned_by = created_by` (le praticien qui a créé l'invitation) et
   * le patient reçoit une notif+email pour chaque template.
   *
   * Limite à 10 templates pour éviter le spam ; en pratique 1-3 suffisent
   * (bilan initial, consentement, hygiène de vie).
   */
  @ApiPropertyOptional({
    type: [String],
    description: 'IDs de templates de formulaires à assigner à l\'acceptation.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  form_template_ids?: string[];
}

export class AcceptInvitationDto {
  @ApiProperty({ description: 'Token brut envoyé au patient' })
  @IsString()
  @MaxLength(200)
  token!: string;

  @ApiProperty({
    description: 'Mot de passe choisi par le patient (min. 8 caractères)',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;
}
