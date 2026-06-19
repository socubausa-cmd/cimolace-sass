import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * Body for POST /med/forms/:formId/assign — assign a precise form to a
 * precise patient. `patient_id` must be a med_patients UUID belonging to the
 * caller's tenant; `note` is an optional free-text instruction for the patient.
 */
export class AssignFormDto {
  @IsUUID() patient_id: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}
