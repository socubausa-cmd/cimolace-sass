import { IsEmail, IsIn, IsNotEmpty, IsString, Matches } from 'class-validator';

export class TenantTokenDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^mdk_[a-f0-9]{64}$/, { message: 'apiKey invalide' })
  apiKey: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsEmail()
  email: string;

  @IsIn(['owner', 'admin', 'practitioner', 'patient', 'receptionist'])
  role: string;
}
