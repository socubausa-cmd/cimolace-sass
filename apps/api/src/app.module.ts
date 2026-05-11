import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CheckoutModule } from './checkout/checkout.module';
import { CimolaceCatalogModule } from './cimolace-catalog/cimolace-catalog.module';
import { HealthController } from './health.controller';
import { LiveKitModule } from './livekit/livekit.module';
import { LiveModule } from './live/live.module';
import { MarketingModule } from './marketing/marketing.module';
import { MedosModule } from './medos/medos.module';
import { SupabaseModule } from './supabase/supabase.module';
import { TenantModule } from './tenant/tenant.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(__dirname, '..', '..', '..', '.env'),
        join(__dirname, '..', '..', '..', '.env.local'),
        join(__dirname, '..', '.env'),
        join(__dirname, '..', '.env.local'),
      ],
    }),
    SupabaseModule,
    LiveKitModule,
    AuthModule,
    TenantModule,
    LiveModule,
    CheckoutModule,
    MarketingModule,
    CimolaceCatalogModule,
    MedosModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
