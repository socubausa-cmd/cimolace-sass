import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class CreatePopupDto {
  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsIn(['exit_intent', 'scroll', 'time'])
  triggerType: 'exit_intent' | 'scroll' | 'time';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
