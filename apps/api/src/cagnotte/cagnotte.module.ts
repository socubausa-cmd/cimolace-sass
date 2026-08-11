import { Module } from '@nestjs/common';
import { PawaPayModule } from '../pawapay/pawapay.module';
import { TenantModule } from '../tenant/tenant.module';
import { AuthModule } from '../auth/auth.module';
import { CagnotteController } from './cagnotte.controller';
import { CagnotteService } from './cagnotte.service';

/** SupabaseModule est @Global → SupabaseService injectable sans import.
 *  TenantModule/AuthModule : requis par les routes ADMIN du studio (JwtAuthGuard + TenantGuard). */
@Module({
  imports: [PawaPayModule, TenantModule, AuthModule],
  controllers: [CagnotteController],
  providers: [CagnotteService],
})
export class CagnotteModule {}
