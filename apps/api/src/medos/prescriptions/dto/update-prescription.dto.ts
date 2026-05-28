import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Mise à jour d'une prescription. Possible uniquement tant qu'elle est en
 * statut `draft`. Une prescription signée est immuable.
 */
export class UpdatePrescriptionDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 365 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  validity_days?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  patient_instructions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  practitioner_notes?: string;
}
