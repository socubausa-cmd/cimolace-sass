import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateHealthEntryDto {
  @IsUUID() patient_id: string;
  @IsDateString() @IsOptional() entry_date?: string;
  @IsString() @IsIn(['mood','sleep','vitals','food','activity','symptom','custom']) @IsOptional() entry_type?: string;

  @IsInt() @Min(1) @Max(10) @IsOptional() mood_score?: number;
  @IsInt() @Min(1) @Max(10) @IsOptional() energy_level?: number;
  @IsNumber() @IsOptional() sleep_hours?: number;
  @IsInt() @Min(1) @Max(5) @IsOptional() sleep_quality?: number;
  @IsNumber() @IsOptional() weight_kg?: number;
  @IsInt() @IsOptional() blood_pressure_systolic?: number;
  @IsInt() @IsOptional() blood_pressure_diastolic?: number;
  @IsInt() @IsOptional() heart_rate?: number;
  @IsNumber() @IsOptional() blood_glucose?: number;
  @IsNumber() @IsOptional() temperature?: number;
  @IsObject() @IsOptional() meal_photos?: Record<string, unknown>[];
  @IsString() @IsOptional() food_notes?: string;
  @IsNumber() @IsOptional() water_liters?: number;
  @IsInt() @IsOptional() steps?: number;
  @IsInt() @IsOptional() exercise_minutes?: number;
  @IsObject() @IsOptional() symptoms?: Record<string, unknown>[];
  @IsString() @IsOptional() notes?: string;

  // Provenance de la saisie (RPM). 'home_device' = constante relevée sur un
  // appareil maison (tensiomètre/glucomètre/balance/oxymètre/FC). Défaut côté
  // service = 'manual'. Whitelist appliquée dans createHealthEntry.
  @IsString()
  @IsIn(['manual', 'home_device', 'questionnaire', 'import'])
  @IsOptional()
  source?: string;
}
