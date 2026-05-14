import { IsString, IsOptional, IsIn, IsNumber, Min } from 'class-validator';

export class CreateVideoAssetDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsIn(['mux', 'cloudflare', 'local'])
  provider?: 'mux' | 'cloudflare' | 'local';

  @IsOptional()
  @IsString()
  source_url?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  duration_sec?: number;
}
