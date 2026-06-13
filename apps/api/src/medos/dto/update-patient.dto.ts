import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePatientDto {
  @IsOptional()
  @IsString()
  @IsIn(['active', 'archived', 'deceased'])
  status?: string;

  @IsOptional()
  @IsDateString()
  date_of_birth?: string;

  @IsOptional()
  @IsIn(['male', 'female', 'other', 'prefer_not_to_say'])
  gender?: string;

  @IsOptional()
  @IsString()
  blood_type?: string;

  // @Type(() => Object) empêche enableImplicitConversion de vider chaque
  // objet du tableau en [] (corruption silencieuse sous whitelist:true).
  @IsOptional()
  @IsArray()
  @Type(() => Object)
  allergies?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  @Type(() => Object)
  chronic_conditions?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  @Type(() => Object)
  current_medications?: Record<string, unknown>[];

  @IsOptional()
  @IsObject()
  medical_history?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  family_history?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  emergency_contact?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  insurance_info?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  consent_given?: boolean;

  @IsOptional()
  @IsString()
  consent_purpose?: string;
}
