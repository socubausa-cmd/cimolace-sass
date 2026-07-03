import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateTeleconsultDto {
  @ApiProperty()
  @IsUUID()
  patient_id!: string;

  @ApiPropertyOptional({ description: 'RDV associé (recommandé)' })
  @IsOptional()
  @IsUUID()
  appointment_id?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  recording_consented?: boolean;
}

export class CreateInviteDto {
  @ApiPropertyOptional({ description: 'Nom du proche affiché aux participants' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  display_name?: string;

  @ApiPropertyOptional({ description: 'Lien de parenté (ex: Conjoint, Fille)' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  relationship?: string;

  @ApiPropertyOptional({ description: 'Email du concerné → reçoit le lien d’invitation' })
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional({ description: 'Membre du tenant à inviter (compte existant) → admis d’office' })
  @IsOptional()
  @IsUUID()
  invited_user_id?: string;

  @ApiPropertyOptional({ enum: ['proche', 'member'], default: 'proche' })
  @IsOptional()
  @IsEnum(['proche', 'member'])
  kind?: 'proche' | 'member';
}

export class ConsentInviteDto {
  @ApiProperty({ description: 'true = le patient autorise, false = refuse' })
  @IsBoolean()
  granted!: boolean;
}

export class EndTeleconsultDto {
  @ApiPropertyOptional({
    enum: ['normal', 'timeout', 'network', 'manual', 'error'],
    default: 'normal',
  })
  @IsOptional()
  @IsEnum(['normal', 'timeout', 'network', 'manual', 'error'])
  ended_reason?: 'normal' | 'timeout' | 'network' | 'manual' | 'error';

  @ApiPropertyOptional({ enum: ['good', 'degraded', 'poor', 'unknown'] })
  @IsOptional()
  @IsEnum(['good', 'degraded', 'poor', 'unknown'])
  connection_quality?: 'good' | 'degraded' | 'poor' | 'unknown';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  technical_issues?: string;

  @ApiPropertyOptional({
    description: 'Note rapide post-consult (alimente une note SOAP plus tard)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  quick_note?: string;
}
