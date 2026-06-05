import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class BiomarkerValueDto {
  @ApiProperty({ example: 'CRP_HS' })
  @IsString()
  @MaxLength(40)
  biomarker_code!: string;

  @ApiProperty({ example: 3.2 })
  @IsNumber()
  value!: number;

  @ApiPropertyOptional({ example: 'mg/L' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @ApiPropertyOptional({ example: '2026-06-01' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  measured_at?: string;
}

export class AddBiomarkersDto {
  @ApiProperty({ type: [BiomarkerValueDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => BiomarkerValueDto)
  biomarkers!: BiomarkerValueDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lab_document_id?: string;
}

export class OrganAssistantDto {
  @ApiProperty({ example: 'liver' })
  @IsString()
  @MaxLength(40)
  organ_code!: string;

  @ApiPropertyOptional({ example: 'Pourquoi le foie est-il en orange ?' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  question?: string;
}

export class CreateLabDocumentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  attachment_id?: string;

  @ApiPropertyOptional({ example: 'blood' })
  @IsOptional()
  @IsIn(['blood', 'imaging', 'prescription', 'specialist', 'microbiome', 'dna', 'other'])
  source_type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  lab_name?: string;

  @ApiPropertyOptional({ description: 'Texte brut du document (si déjà OCRisé)' })
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  raw_text?: string;
}
