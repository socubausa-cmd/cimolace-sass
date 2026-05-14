import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { CreateBannerDto } from './dto/create-banner.dto';
import { CreatePopupDto } from './dto/create-popup.dto';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { UpdatePopupDto } from './dto/update-popup.dto';
import { UpdatePromoCodeDto } from './dto/update-promo-code.dto';
import { MarketingService } from './marketing.service';

@Controller('marketing')
@UseGuards(JwtAuthGuard, TenantGuard)
export class MarketingController {
  constructor(private readonly marketingService: MarketingService) {}

  // Promo codes
  @Get('promo-codes')
  findAllPromoCodes(@CurrentTenant() tenant: TenantContext) {
    return this.marketingService.findAllPromoCodes(tenant.id);
  }

  @Post('promo-codes')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  createPromoCode(
    @Body() dto: CreatePromoCodeDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.marketingService.createPromoCode(dto, tenant.id);
  }

  @Get('promo-codes/:id')
  findOnePromoCode(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.marketingService.findOnePromoCode(id, tenant.id);
  }

  @Patch('promo-codes/:id')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  updatePromoCode(
    @Param('id') id: string,
    @Body() dto: UpdatePromoCodeDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.marketingService.updatePromoCode(id, dto, tenant.id);
  }

  @Delete('promo-codes/:id')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  removePromoCode(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.marketingService.removePromoCode(id, tenant.id);
  }

  // Popups
  @Get('popups')
  findAllPopups(@CurrentTenant() tenant: TenantContext) {
    return this.marketingService.findAllPopups(tenant.id);
  }

  @Post('popups')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  createPopup(
    @Body() dto: CreatePopupDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.marketingService.createPopup(dto, tenant.id);
  }

  @Get('popups/:id')
  findOnePopup(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.marketingService.findOnePopup(id, tenant.id);
  }

  @Patch('popups/:id')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  updatePopup(
    @Param('id') id: string,
    @Body() dto: UpdatePopupDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.marketingService.updatePopup(id, dto, tenant.id);
  }

  @Delete('popups/:id')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  removePopup(@Param('id') id: string, @CurrentTenant() tenant: TenantContext) {
    return this.marketingService.removePopup(id, tenant.id);
  }

  // Banners
  @Get('banners')
  findAllBanners(@CurrentTenant() tenant: TenantContext) {
    return this.marketingService.findAllBanners(tenant.id);
  }

  @Post('banners')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  createBanner(
    @Body() dto: CreateBannerDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.marketingService.createBanner(dto, tenant.id);
  }

  @Get('banners/:id')
  findOneBanner(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.marketingService.findOneBanner(id, tenant.id);
  }

  @Patch('banners/:id')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  updateBanner(
    @Param('id') id: string,
    @Body() dto: UpdateBannerDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.marketingService.updateBanner(id, dto, tenant.id);
  }

  @Delete('banners/:id')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  removeBanner(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.marketingService.removeBanner(id, tenant.id);
  }
}
