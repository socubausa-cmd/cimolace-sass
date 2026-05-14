import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDeckDto {
  @IsString()
  @MaxLength(500)
  title: string;

  @IsString()
  sourceText: string;

  @IsOptional()
  @IsString()
  lang?: string;
}
