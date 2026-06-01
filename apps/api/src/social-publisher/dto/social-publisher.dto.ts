import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, IsUUID, IsIn } from 'class-validator';

export class PublishShortDto {
  @ApiProperty({ description: 'ID du short_clip à publier' })
  @IsUUID()
  short_clip_id: string;

  @ApiProperty({ enum: ['tiktok', 'facebook', 'instagram', 'youtube_shorts'] })
  @IsIn(['tiktok', 'facebook', 'instagram', 'youtube_shorts'])
  platform: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  hashtags?: string[];
}

export class SaveSocialTokenDto {
  @ApiProperty({ enum: ['tiktok', 'facebook', 'instagram'] })
  @IsIn(['tiktok', 'facebook', 'instagram'])
  platform: string;

  @ApiProperty()
  @IsString()
  access_token: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refresh_token?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  page_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  page_name?: string;
}
