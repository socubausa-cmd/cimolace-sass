import {
  IsArray,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateNoteDto {
  @IsOptional()
  @IsString()
  subjective?: string;

  @IsOptional()
  @IsString()
  objective?: string;

  @IsOptional()
  @IsString()
  assessment?: string;

  @IsOptional()
  @IsString()
  plan?: string;

  @IsOptional()
  @IsString()
  free_text?: string;

  @IsOptional()
  @IsArray()
  icd10_codes?: { code: string; description: string; is_primary?: boolean }[];
}
