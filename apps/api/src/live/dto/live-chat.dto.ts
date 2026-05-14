import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SendChatDto {
  @IsString() @MaxLength(2000) content: string;
}

export class AskQuestionDto {
  @IsString() @MaxLength(1000) content: string;
  @IsOptional() @IsString() category?: string;
}

export class AnswerQuestionDto {
  @IsString() @MaxLength(2000) content: string;
}
