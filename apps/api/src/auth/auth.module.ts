import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { TenantApiKeyService } from '../tenant/tenant-api-key.service';
import { EmailEngineModule } from '../email-engine/email-engine.module';
import { PasswordResetController } from './password-reset.controller';
import { PasswordResetService } from './password-reset.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), EmailEngineModule],
  controllers: [AuthController, PasswordResetController],
  providers: [AuthService, JwtStrategy, TenantApiKeyService, PasswordResetService],
  exports: [AuthService, TenantApiKeyService, PassportModule],
})
export class AuthModule {}
