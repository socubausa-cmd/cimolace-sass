import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateFormDto {
  @IsString() @IsOptional() title?: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsIn(['intake','assessment','consent','followup','custom']) @IsOptional() category?: string;
  @IsArray() @IsOptional() fields?: Record<string, unknown>[];
  @IsBoolean() @IsOptional() is_template?: boolean;
  @IsInt() @IsOptional() send_before_days?: number;
}
