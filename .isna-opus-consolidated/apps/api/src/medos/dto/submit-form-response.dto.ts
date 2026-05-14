import { IsObject, IsUUID } from 'class-validator';

export class SubmitFormResponseDto {
  @IsUUID() patient_id: string;
  @IsObject() responses: Record<string, unknown>;
}
