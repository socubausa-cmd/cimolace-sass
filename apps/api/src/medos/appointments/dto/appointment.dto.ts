import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// ─── Availability ────────────────────────────────────────────────────────

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export class CreateAvailabilityDto {
  @ApiProperty({ description: 'UUID du praticien' })
  @IsUUID()
  practitioner_id!: string;

  @ApiPropertyOptional({ description: 'Jour de semaine (0=dim, 6=sam)', minimum: 0, maximum: 6 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weekday?: number;

  @ApiPropertyOptional({ description: 'Date ponctuelle (YYYY-MM-DD), pour créneaux exceptionnels' })
  @IsOptional()
  @IsDateString()
  specific_date?: string;

  @ApiProperty({ example: '09:00' })
  @IsString()
  @Matches(TIME_REGEX, { message: 'start_time format HH:MM ou HH:MM:SS' })
  start_time!: string;

  @ApiProperty({ example: '17:00' })
  @IsString()
  @Matches(TIME_REGEX, { message: 'end_time format HH:MM ou HH:MM:SS' })
  end_time!: string;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(240)
  slot_duration_minutes?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  buffer_minutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateAvailabilityDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(TIME_REGEX)
  start_time?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(TIME_REGEX)
  end_time?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(240)
  slot_duration_minutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  buffer_minutes?: number;
}

// ─── Appointments ────────────────────────────────────────────────────────

const APPOINTMENT_TYPES = ['in_person', 'teleconsult', 'phone', 'home_visit'] as const;
type AppointmentType = (typeof APPOINTMENT_TYPES)[number];

export class CreateAppointmentDto {
  @ApiProperty()
  @IsUUID()
  patient_id!: string;

  @ApiProperty()
  @IsUUID()
  practitioner_id!: string;

  @ApiProperty({ description: 'ISO 8601 timestamp' })
  @IsDateString()
  scheduled_at!: string;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(240)
  duration_minutes?: number;

  @ApiPropertyOptional({ enum: APPOINTMENT_TYPES })
  @IsOptional()
  @IsString()
  appointment_type?: AppointmentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;

  /**
   * Marketplace praticien : clé du SERVICE du catalogue (billing_plans.key) auquel
   * ce RDV est rattaché. Si le service est PAYANT, le serveur exige un access_pass
   * actif (payé) avant de créer le RDV, et reprend le prix du service.
   */
  @ApiPropertyOptional({ description: 'Clé du service catalogue (billing_plans.key)' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  service_key?: string;
}

export class UpdateAppointmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduled_at?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(240)
  duration_minutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  internal_notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  price_cents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;
}

export class CancelAppointmentDto {
  @ApiProperty({ description: 'Motif (obligatoire, 3 chars min)' })
  @IsString()
  @MaxLength(500)
  reason!: string;
}
