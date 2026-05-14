import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateTenantServiceDto {
  @IsString()
  service_key: string;

  @IsBoolean()
  active: boolean;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
