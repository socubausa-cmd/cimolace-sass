import { Module } from '@nestjs/common';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

@Module({
  providers: [CheckoutService],
  controllers: [CheckoutController],
})
export class CheckoutModule {}
