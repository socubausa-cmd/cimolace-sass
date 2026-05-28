import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
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
}

export class AcceptInvitationDto {
  @ApiProperty({ description: 'Token brut envoyé au patient' })
  @IsString()
  @MaxLength(200)
  token!: string;

  @ApiProperty({ description: 'user_id Supabase qui accepte (nouveau ou existant)' })
  @IsUUID()
  accepted_by_user_id!: string;
}
