import { IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateBannerDto {
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  ctaUrl?: string;

  @IsOptional()
  @IsString()
  ctaLabel?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
