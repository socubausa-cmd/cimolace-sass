import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateMasterclassDto {
  @ApiProperty({
    description: 'Texte source brut a transformer en masterclass',
    maxLength: 100000,
  })
  @IsString()
  @MaxLength(100000)
  sourceText: string;

  @ApiPropertyOptional({
    description: 'Langue cible (fr, en, ar...)',
    example: 'fr',
  })
  @IsOptional()
  @IsString()
  lang?: string;

  @ApiPropertyOptional({
    enum: ['liri-v1', 'failure-v2'],
    description: 'Modele pedagogique',
  })
  @IsOptional()
  @IsIn(['liri-v1', 'failure-v2'])
  pedagogicalModel?: string;
}

export class AnalyzeDocumentDto {
  @ApiProperty({ description: 'Texte source a analyser', maxLength: 100000 })
  @IsString()
  @MaxLength(100000)
  sourceText: string;

  @ApiPropertyOptional({ description: 'Langue cible', example: 'fr' })
  @IsOptional()
  @IsString()
  lang?: string;
}

export class EnqueueOrchestratorDto {
  @ApiProperty({ description: "Texte source pour l'orchestrateur IA" })
  @IsString()
  sourceText: string;

  @ApiPropertyOptional({ enum: ['liri-v1', 'failure-v2'] })
  @IsOptional()
  @IsIn(['liri-v1', 'failure-v2'])
  pedagogicalModel?: string;

  @ApiPropertyOptional({ description: 'Titre du projet a creer' })
  @IsOptional()
  @IsString()
  title?: string;
}

export class OrchestratorStatusDto {
  @ApiProperty({ description: 'ID du job a interroger', format: 'uuid' })
  @IsString()
  jobId: string;
}
