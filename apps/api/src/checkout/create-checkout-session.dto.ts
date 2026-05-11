import { IsUUID } from 'class-validator';

export class CreateCheckoutSessionDto {
  @IsUUID()
  liveSessionId: string;
}
