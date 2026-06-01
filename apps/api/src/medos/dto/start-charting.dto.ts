import { IsIn, IsOptional, IsString, IsUUID, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StartChartingDto {
  @ApiProperty({ description: 'UUID du dossier patient', format: 'uuid' })
  @IsUUID()
  patient_id: string;

  @ApiProperty({
    description: 'URL du fichier audio (Supabase Storage, R2...)',
    example: 'https://storage.supabase.co/audio/consult-001.mp3',
  })
  @IsUrl()
  audio_url: string;

  @ApiPropertyOptional({
    description:
      'UUID de la note existante a enrichir (cree une note draft si absent)',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  note_id?: string;

  @ApiPropertyOptional({
    description: "Contexte transmis a l'IA pour affiner la generation",
  })
  @IsOptional()
  @IsString()
  context_hint?: string;

  @ApiPropertyOptional({
    enum: ['fr', 'en', 'ar', 'sw', 'pt', 'es'],
    description: 'Langue principale de la consultation (defaut: fr)',
  })
  @IsOptional()
  @IsIn(['fr', 'en', 'ar', 'sw', 'pt', 'es'])
  language?: string;
}
