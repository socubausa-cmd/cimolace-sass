import { Module } from '@nestjs/common';
import { PawaPayModule } from '../pawapay/pawapay.module';
import { CagnotteController } from './cagnotte.controller';
import { CagnotteService } from './cagnotte.service';

/** SupabaseModule est @Global → SupabaseService injectable sans import. */
@Module({
  imports: [PawaPayModule],
  controllers: [CagnotteController],
  providers: [CagnotteService],
})
export class CagnotteModule {}
