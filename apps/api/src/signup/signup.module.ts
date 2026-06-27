import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
// MboloModule exporte MboloService : utilisé pour auto-installer la boutique
// (clé storefront + catalogue de départ) quand kind === 'mbolo' au signup.
import { MboloModule } from '../mbolo/mbolo.module';
// AuthModule exporte AuthService : requis par le JwtAuthGuard de l'endpoint
// POST /signup/tenant-from-oauth (variante OAuth). Sans cet import, Nest ne peut
// pas résoudre AuthService dans le contexte SignupModule → crash au boot.
import { AuthModule } from '../auth/auth.module';
import { SignupController } from './signup.controller';
import { SignupService } from './signup.service';

@Module({
  imports: [SupabaseModule, MboloModule, AuthModule],
  controllers: [SignupController],
  providers: [SignupService],
})
export class SignupModule {}
