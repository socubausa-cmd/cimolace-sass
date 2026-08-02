import { IsArray, IsBoolean, IsIn, IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SetPreparationDto {
  @IsOptional()
  @IsArray()
  planJson?: any[];

  @IsOptional()
  @IsIn(['chat', 'live', 'chat_then_live'])
  roomType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notesSecretary?: string | null;

  @IsOptional()
  @IsArray()
  documentsJson?: any[];

  @IsOptional()
  @IsBoolean()
  isReady?: boolean;

  @IsOptional()
  @IsIn(['preparing', 'ready', 'in_progress', 'confirmed'])
  newStatus?: string | null;
}

export class CreateAppointmentDto {
  @IsUUID()
  slotId: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  source?: string;
}

export class UpdateAppointmentDto {
  @IsOptional()
  @IsIn(['confirmed', 'cancelled', 'completed', 'no_show'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  /** Reprogrammation : nouveau début du créneau (ISO). Déplace le booking_slot lié. */
  @IsOptional()
  @IsISO8601()
  newStartAt?: string;

  /** Motif/explication joint à la notification (confirmation, report, annulation). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CreateSlotDto {
  @IsISO8601()
  startAt: string;

  @IsISO8601()
  endAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsString()
  type?: string;
}

export class SubmitFeedbackDto {
  @IsUUID()
  appointmentId: string;

  @IsIn([1, 2, 3, 4, 5])
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
