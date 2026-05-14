import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateClientDto {
  @IsString() @MaxLength(200) name: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() plan?: string;
}

export class UpdateClientDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() status?: string;
}
