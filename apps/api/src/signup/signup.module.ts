import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
// MboloModule exporte MboloService : utilisé pour auto-installer la boutique
// (clé storefront + catalogue de départ) quand kind === 'mbolo' au signup.
import { MboloModule } from '../mbolo/mbolo.module';
import { SignupController } from './signup.controller';
import { SignupService } from './signup.service';

@Module({
  imports: [SupabaseModule, MboloModule],
  controllers: [SignupController],
  providers: [SignupService],
})
export class SignupModule {}
