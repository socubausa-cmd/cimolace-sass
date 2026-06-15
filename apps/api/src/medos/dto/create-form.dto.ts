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
  @IsString() @IsIn(['text','textarea','number','select','checkbox','multi','date','file']) type: string;
  @IsString() label: string;
  @IsBoolean() @IsOptional() required?: boolean;
  @IsArray() @IsOptional() options?: string[];
}

export class CreateFormDto {
  @IsString() @MinLength(1) title: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsIn(['intake','assessment','consent','followup','custom']) @IsOptional() category?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => FormFieldDto) fields: FormFieldDto[];
  @IsBoolean() @IsOptional() is_template?: boolean;
  @IsInt() @IsOptional() send_before_days?: number;
}
