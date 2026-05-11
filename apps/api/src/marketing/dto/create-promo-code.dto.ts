import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePromoCodeDto {
  @IsString()
  code: string;

  @IsIn(['percent', 'fixed'])
  discountType: 'percent' | 'fixed';

  @IsInt()
  @Min(1)
  discountValue: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
