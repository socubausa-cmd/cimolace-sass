import { IsOptional, IsString, MaxLength } from 'class-validator';

export class GenerateSlidesDto {
  @IsOptional()
  @IsString()
  lang?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  chapterTitle?: string;
}
