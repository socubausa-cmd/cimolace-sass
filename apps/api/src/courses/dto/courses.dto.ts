import { IsArray, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateCourseDto {
  @IsString() @MaxLength(500) title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsInt() @Min(0) priceCents?: number;
}

export class CreateModuleDto {
  @IsString() @MaxLength(500) title: string;
  @IsOptional() @IsString() description?: string;
  @IsInt() @Min(0) orderIndex: number;
}

export class CreateLessonDto {
  @IsString() @MaxLength(500) title: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() videoUrl?: string;
  @IsInt() @Min(0) orderIndex: number;
}

export class UpdateProgressDto {
  @IsString() status: string;
  @IsOptional() @IsInt() @Min(0) timeSpentSeconds?: number;
}
