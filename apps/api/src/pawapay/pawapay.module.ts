import { Module } from '@nestjs/common';
import { PawaPayService } from './pawapay.service';

@Module({
  providers: [PawaPayService],
  exports: [PawaPayService],
})
export class PawaPayModule {}
