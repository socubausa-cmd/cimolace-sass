import { IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateBannerDto {
  @IsString()
  text: string;

  @IsUrl({ require_protocol: true })
  ctaUrl: string;

  @IsString()
  ctaLabel: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
