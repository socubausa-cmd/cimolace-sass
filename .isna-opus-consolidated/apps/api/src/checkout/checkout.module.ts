import { Module } from '@nestjs/common';
import { PawaPayModule } from '../pawapay/pawapay.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

@Module({
  imports: [PawaPayModule],
  providers: [CheckoutService],
  controllers: [CheckoutController],
})
export class CheckoutModule {}
