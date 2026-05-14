import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TenantApiKeyService } from '../tenant/tenant-api-key.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, TenantApiKeyService],
  exports: [AuthService, TenantApiKeyService],
})
export class AuthModule {}
