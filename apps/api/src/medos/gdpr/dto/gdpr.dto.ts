import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

const CONSENT_SCOPES = [
  'general_care',
  'data_processing',
  'data_sharing_practitioners',
  'data_sharing_research',
  'ai_charting',
  'teleconsult_recording',
  'marketing_communications',
  'third_party_integration',
] as const;

export class CreateConsentDto {
  @ApiProperty()
  @IsUUID()
  patient_id!: string;

  @ApiProperty({ enum: CONSENT_SCOPES })
  @IsEnum(CONSENT_SCOPES)
  scope!: (typeof CONSENT_SCOPES)[number];

  @ApiProperty()
  @IsBoolean()
  granted!: boolean;

  @ApiProperty({ description: 'Texte exact présenté au patient' })
  @IsString()
  @MaxLength(5000)
  consent_text!: string;

  @ApiProperty({ description: 'Version du document de consentement' })
  @IsString()
  @MaxLength(50)
  consent_version!: string;

  @ApiPropertyOptional({ description: 'Signature dessinée (base64)' })
  @IsOptional()
  @IsString()
  signature_data?: string;

  @ApiPropertyOptional({ enum: ['web', 'widget', 'paper', 'phone', 'api'] })
  @IsOptional()
  @IsEnum(['web', 'widget', 'paper', 'phone', 'api'])
  recorded_via?: 'web' | 'widget' | 'paper' | 'phone' | 'api';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  related_form_response_id?: string;
}

export class RequestExportDto {
  @ApiProperty()
  @IsUUID()
  patient_id!: string;

  @ApiPropertyOptional({ enum: ['json', 'pdf', 'zip'], default: 'json' })
  @IsOptional()
  @IsEnum(['json', 'pdf', 'zip'])
  format?: 'json' | 'pdf' | 'zip';

  @ApiPropertyOptional({
    enum: ['full', 'medical_only', 'administrative_only', 'custom'],
    default: 'full',
  })
  @IsOptional()
  @IsEnum(['full', 'medical_only', 'administrative_only', 'custom'])
  scope?: 'full' | 'medical_only' | 'administrative_only' | 'custom';

  @ApiPropertyOptional({ description: 'Si scope=custom : tables à inclure' })
  @IsOptional()
  @IsObject()
  custom_scope?: Record<string, unknown>;
}

export class RequestAnonymizationDto {
  @ApiProperty()
  @IsUUID()
  patient_id!: string;

  @ApiProperty({ description: 'Base légale (texte libre obligatoire)' })
  @IsString()
  @MaxLength(500)
  legal_basis!: string;

  @ApiPropertyOptional({
    enum: ['pseudonymization', 'full_deletion', 'partial_deletion'],
    default: 'pseudonymization',
  })
  @IsOptional()
  @IsEnum(['pseudonymization', 'full_deletion', 'partial_deletion'])
  method?: 'pseudonymization' | 'full_deletion' | 'partial_deletion';

  @ApiPropertyOptional({
    enum: ['full', 'identifiers_only', 'medical_only'],
    default: 'full',
  })
  @IsOptional()
  @IsEnum(['full', 'identifiers_only', 'medical_only'])
  scope?: 'full' | 'identifiers_only' | 'medical_only';
}
