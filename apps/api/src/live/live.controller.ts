import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '../auth/current-user.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { CreateLiveDto } from './create-live.dto';
import { LiveService } from './live.service';

@Controller('lives')
@UseGuards(JwtAuthGuard, TenantGuard)
export class LiveController {
  constructor(private readonly liveService: LiveService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin', 'teacher')
  create(
    @Body() dto: CreateLiveDto,
    @CurrentUser() user: AuthUser,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.liveService.create(dto, user.id, tenant);
  }

  @Get()
  findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.liveService.findAll(
      tenant.id,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentTenant() tenant: TenantContext) {
    return this.liveService.findOne(id, tenant.id);
  }

  @Get(':id/token')
  getToken(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.liveService.getJoinToken(id, user, tenant);
  }
}
