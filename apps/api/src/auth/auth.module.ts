import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { TenantApiKeyService } from '../tenant/tenant-api-key.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, TenantApiKeyService],
  exports: [AuthService, TenantApiKeyService, PassportModule],
})
export class AuthModule {}
