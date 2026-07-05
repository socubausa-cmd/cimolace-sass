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

/** Contenu éditorial de la vitrine — persisté dans `tenants.metadata.site` (merge non destructif). */
class SiteContentDto {
  @IsOptional()
  @IsString()
  @MaxLength(600)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  slogan?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  vision?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  website?: string;
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

  @IsOptional()
  @ValidateNested()
  @Type(() => SiteContentDto)
  site?: SiteContentDto;
}
