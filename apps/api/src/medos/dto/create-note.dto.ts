import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Code CIM-10 d'une note. Classe réelle (pas un type inline) pour que
 * class-transformer connaisse la forme des éléments du tableau : sans ça,
 * sous ValidationPipe { whitelist:true, enableImplicitConversion:true },
 * chaque objet du tableau est coercé en [] (corruption silencieuse).
 */
export class Icd10CodeDto {
  @IsString()
  code!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;
}

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
  @ValidateNested({ each: true })
  @Type(() => Icd10CodeDto)
  icd10_codes?: Icd10CodeDto[];
}
