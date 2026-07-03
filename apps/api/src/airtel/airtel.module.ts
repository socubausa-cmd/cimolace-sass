import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AirtelMoneyService } from './airtel.service';

/**
 * Module Airtel Money (Airtel Africa Open API) — rail de décaissement direct.
 * Exporte AirtelMoneyService pour la console finance (cimolace-backoffice).
 */
@Module({
  imports: [ConfigModule],
  providers: [AirtelMoneyService],
  exports: [AirtelMoneyService],
})
export class AirtelModule {}
