import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdatePopupDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsIn(['exit_intent', 'scroll', 'time'])
  triggerType?: 'exit_intent' | 'scroll' | 'time';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
