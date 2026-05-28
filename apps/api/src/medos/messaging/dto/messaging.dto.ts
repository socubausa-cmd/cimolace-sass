import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateThreadDto {
  @ApiProperty()
  @IsUUID()
  patient_id!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiPropertyOptional({ enum: ['low', 'normal', 'high', 'urgent'] })
  @IsOptional()
  @IsEnum(['low', 'normal', 'high', 'urgent'])
  priority?: 'low' | 'normal' | 'high' | 'urgent';

  @ApiPropertyOptional({ description: 'Premier message (optionnel)' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  initial_message?: string;
}

export class SendMessageDto {
  @ApiProperty()
  @IsString()
  @MaxLength(5000)
  body!: string;

  @ApiPropertyOptional({ description: 'IDs des pièces jointes (med_attachments)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  attachment_ids?: string[];
}

export class CloseThreadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
