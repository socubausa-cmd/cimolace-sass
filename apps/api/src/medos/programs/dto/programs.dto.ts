import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

const PROGRAM_CATEGORIES = [
  'weight_loss',
  'detox',
  'stress',
  'post_op',
  'chronic_disease',
  'fertility',
  'pregnancy',
  'nutrition',
  'rehab',
  'custom',
] as const;

const STEP_TYPES = [
  'task',
  'form',
  'measurement',
  'content',
  'appointment',
  'reminder',
] as const;

export class CreateProgramDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: PROGRAM_CATEGORIES })
  @IsOptional()
  @IsEnum(PROGRAM_CATEGORIES)
  category?: (typeof PROGRAM_CATEGORIES)[number];

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  duration_days?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  is_template?: boolean;
}

export class UpdateProgramDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: PROGRAM_CATEGORIES })
  @IsOptional()
  @IsEnum(PROGRAM_CATEGORIES)
  category?: (typeof PROGRAM_CATEGORIES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  duration_days?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class CreateStepDto {
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: STEP_TYPES, default: 'task' })
  @IsOptional()
  @IsEnum(STEP_TYPES)
  step_type?: (typeof STEP_TYPES)[number];

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  due_after_days?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  linked_form_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content_md?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_required?: boolean;
}

export class EnrollPatientDto {
  @ApiProperty()
  @IsUUID()
  patient_id!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateEnrollmentDto {
  @ApiPropertyOptional({ enum: ['active', 'paused', 'completed', 'abandoned'] })
  @IsOptional()
  @IsEnum(['active', 'paused', 'completed', 'abandoned'])
  status?: 'active' | 'paused' | 'completed' | 'abandoned';

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  current_step_position?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  progress_percent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
