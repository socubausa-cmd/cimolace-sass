import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePrescriptionItemDto {
  @ApiProperty({ example: 'Paracétamol 1000mg' })
  @IsString()
  @MaxLength(200)
  drug_name!: string;

  @ApiPropertyOptional({ example: 'N02BE01' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  drug_code?: string;

  @ApiProperty({ example: '1 comprimé' })
  @IsString()
  @MaxLength(100)
  dosage!: string;

  @ApiProperty({ example: '3 fois par jour' })
  @IsString()
  @MaxLength(100)
  frequency!: string;

  @ApiProperty({ example: '5 jours' })
  @IsString()
  @MaxLength(100)
  duration!: string;

  @ApiPropertyOptional({ example: 'oral' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  route?: string;

  @ApiPropertyOptional({ example: '1 boîte de 16' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  quantity?: string;

  @ApiPropertyOptional({ example: 'à prendre pendant les repas' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description:
      'Non substituable (mention médecin). Défaut true = substitution autorisée.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  is_substitutable?: boolean;
}

export class CreatePrescriptionDto {
  @ApiProperty({ description: 'UUID du dossier patient' })
  @IsUUID()
  patient_id!: string;

  @ApiPropertyOptional({
    description: 'Lien optionnel vers la note de consultation associée',
  })
  @IsOptional()
  @IsUUID()
  consultation_note_id?: string;

  @ApiPropertyOptional({
    description: 'Durée légale de validité (jours). Défaut 90.',
    default: 90,
    minimum: 1,
    maximum: 365,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  validity_days?: number;

  @ApiPropertyOptional({
    description: 'Conseils généraux au patient',
  })
  @IsOptional()
  @IsString()
  patient_instructions?: string;

  @ApiPropertyOptional({
    description: 'Notes praticien (non visibles patient)',
  })
  @IsOptional()
  @IsString()
  practitioner_notes?: string;

  @ApiPropertyOptional({
    description:
      'Lignes initiales de la prescription. Peuvent être ajoutées plus tard via POST /items.',
    type: [CreatePrescriptionItemDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreatePrescriptionItemDto)
  items?: CreatePrescriptionItemDto[];
}
