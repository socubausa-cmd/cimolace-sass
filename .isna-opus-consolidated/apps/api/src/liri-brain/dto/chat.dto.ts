import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { LiriModel } from '../liri-brain.types';

export class ChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100_000)
  message: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsIn(['deepseek-chat', 'deepseek-reasoner', 'claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'gpt-4o', 'gpt-4o-mini'])
  model?: LiriModel;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}
