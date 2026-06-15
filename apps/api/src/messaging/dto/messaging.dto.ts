import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsUUID() recipientId: string;
  @IsString() @MaxLength(10000) content: string;
  @IsOptional() @IsString() subject?: string;
}

export class CreateGroupDto {
  @IsString() @MaxLength(200) name: string;
  @IsOptional() @IsString() description?: string;
}

export class EditMessageDto {
  @IsString() @MaxLength(10000) content: string;
}
