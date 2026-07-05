import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LiveKitModule } from '../livekit/livekit.module';
import { LiveJoinService } from './live-join.service';
import { LiveJoinController } from './live-join.controller';

/**
 * Liens de live configurables (scénario A). AuthModule = client Supabase
 * service-role ; LiveKitModule = mint des tokens viewer.
 */
@Module({
  imports: [AuthModule, LiveKitModule],
  controllers: [LiveJoinController],
  providers: [LiveJoinService],
  exports: [LiveJoinService],
})
export class LiveJoinModule {}
