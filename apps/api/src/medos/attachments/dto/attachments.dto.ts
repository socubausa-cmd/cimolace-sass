import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const OWNER_TYPES = [
  'patient',
  'note',
  'prescription',
  'message',
  'program',
  'lab_result',
  'health_entry',
  'form_response',
] as const;

const CATEGORIES = [
  'lab_result',
  'imaging',
  'prescription_pdf',
  'consent_pdf',
  'identity_doc',
  'insurance',
  'meal_photo',
  'self_exam',
  'other',
] as const;

export class CreateAttachmentDto {
  @ApiProperty({ enum: OWNER_TYPES })
  @IsEnum(OWNER_TYPES)
  owner_type!: (typeof OWNER_TYPES)[number];

  @ApiProperty()
  @IsUUID()
  owner_id!: string;

  @ApiProperty()
  @IsUUID()
  patient_id!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  file_name!: string;

  @ApiProperty({ description: 'Taille en bytes' })
  @IsInt()
  @Min(0)
  @Max(500 * 1024 * 1024) // 500 MB max
  file_size_bytes!: number;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  mime_type!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  checksum_sha256?: string;

  @ApiProperty({
    description:
      'Chemin dans le bucket Supabase Storage. Pré-uploadé par le frontend via signed URL.',
  })
  @IsString()
  @MaxLength(500)
  storage_path!: string;

  @ApiPropertyOptional({ default: 'medos' })
  @IsOptional()
  @IsString()
  storage_bucket?: string;

  @ApiPropertyOptional({ enum: CATEGORIES })
  @IsOptional()
  @IsEnum(CATEGORIES)
  category?: (typeof CATEGORIES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  visible_to_patient?: boolean;

  @ApiPropertyOptional({ description: 'Date de l\'acte médical (ISO 8601)' })
  @IsOptional()
  @IsString()
  taken_at?: string;
}

export class UpdateAttachmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: CATEGORIES })
  @IsOptional()
  @IsEnum(CATEGORIES)
  category?: (typeof CATEGORIES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  visible_to_patient?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_archived?: boolean;
}
