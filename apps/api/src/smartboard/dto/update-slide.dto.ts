import { IsOptional, IsString } from 'class-validator';

export class UpdateSlideDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsOptional()
  @IsString()
  core_idea?: string;

  @IsOptional()
  @IsString()
  pedagogical_goal?: string;

  @IsOptional()
  @IsString()
  main_text?: string;

  @IsOptional()
  @IsString()
  support_text?: string;

  @IsOptional()
  @IsString()
  student_action?: string;

  @IsOptional()
  @IsString()
  teacher_note?: string;

  @IsOptional()
  @IsString()
  transition?: string;

  @IsOptional()
  @IsString()
  visual_prompt?: string;
}
