import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class BrandColorsDto {
  @IsOptional()
  @IsString()
  primary?: string;

  @IsOptional()
  @IsString()
  secondary?: string;

  @IsOptional()
  @IsString()
  accent?: string;
}

export class UpdateBrandingDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  logo_url?: string;

  @IsOptional()
  @IsString()
  primary_domain?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => BrandColorsDto)
  brand_colors?: BrandColorsDto;
}
