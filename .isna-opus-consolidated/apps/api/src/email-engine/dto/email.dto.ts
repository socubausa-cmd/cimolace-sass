import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTemplateDto {
  @IsString() @MaxLength(200) name: string;
  @IsString() subject: string;
  @IsString() htmlContent: string;
  @IsOptional() @IsString() category?: string;
}

export class SendEmailDto {
  @IsString() to: string;
  @IsString() templateKey: string;
  data?: Record<string, any>;
}

export class SendCampaignDto {
  @IsString() campaignName: string;
  @IsString() templateKey: string;
  recipientFilter?: Record<string, any>;
}
