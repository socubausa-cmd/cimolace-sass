import { IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class SendNotificationDto {
  @IsUUID() userId: string;
  @IsString() title: string;
  @IsString() body: string;
  @IsOptional() @IsArray() channels?: ('email'|'sms'|'push'|'in_app')[];
  @IsOptional() @IsString() templateKey?: string;
  @IsOptional() data?: Record<string, any>;
}

export class UpdatePreferencesDto {
  @IsOptional() @IsBoolean() emailNotifications?: boolean;
  @IsOptional() @IsBoolean() smsNotifications?: boolean;
  @IsOptional() @IsBoolean() pushNotifications?: boolean;
  @IsOptional() @IsBoolean() inAppNotifications?: boolean;
}
