import { IsString, IsIn, IsOptional, IsObject } from 'class-validator';

export type AiJobType = 'enhance_segment' | 'generate_quiz' | 'summarize' | 'analyze_doc';

export class EnqueueJobDto {
  @IsIn(['enhance_segment', 'generate_quiz', 'summarize', 'analyze_doc'])
  type!: AiJobType;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  model?: string;
}
