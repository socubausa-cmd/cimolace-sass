import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTopicDto {
  @IsString() @MaxLength(500) title: string;
  @IsString() @MaxLength(10000) content: string;
  @IsOptional() @IsString() category?: string;
}

export class CreatePostDto {
  @IsString() @MaxLength(10000) content: string;
  @IsOptional() @IsString() parentPostId?: string;
}
