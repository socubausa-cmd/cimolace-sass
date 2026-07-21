import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class FormFieldDto {
  @IsString() id: string;
  // 'measure' = champ de CONSTANTE objective (tension, poids, glycémie…) qui
  // alimente le jumeau via un biomarqueur (cf. biomarker_code).
  @IsString() @IsIn(['text','textarea','number','select','checkbox','multi','date','file','measure']) type: string;
  @IsString() label: string;
  @IsBoolean() @IsOptional() required?: boolean;
  @IsArray() @IsOptional() options?: string[];
  // (A) Grille de scoring → roue : contributions du champ aux axes (par option
  // ou par plage numérique). Config libre validée par le moteur `form-scoring`.
  @IsArray() @IsOptional() scoring?: Array<Record<string, unknown>>;
  // (B) Champ 'measure' : code de biomarqueur objectif (whitelist côté moteur) +
  // unité affichée. Alimente med_patient_biomarkers → scores d'organes.
  @IsString() @IsOptional() biomarker_code?: string;
  @IsString() @IsOptional() unit?: string;
}

export class CreateFormDto {
  @IsString() @MinLength(1) title: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsIn(['intake','assessment','consent','followup','custom']) @IsOptional() category?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => FormFieldDto) fields: FormFieldDto[];
  @IsBoolean() @IsOptional() is_template?: boolean;
  @IsInt() @IsOptional() send_before_days?: number;
}
