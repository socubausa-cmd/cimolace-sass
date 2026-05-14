import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { MboloService } from './mbolo.service';

@Controller('mbolo')
@UseGuards(JwtAuthGuard, TenantGuard)
export class MboloController {
  constructor(private readonly svc: MboloService) {}
  @Get('products') listProducts(@CurrentTenant() t: TenantContext) { return this.svc.listProducts(t.id); }
  @Get('products/:id') getProduct(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.getProduct(t.id, id); }
  @Post('products') @UseGuards(RolesGuard) @Roles('owner','admin') createProduct(@Body() d: any, @CurrentTenant() t: TenantContext) { return this.svc.createProduct(t.id, d); }
  @Get('cart') getCart(@CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.getCart(t.id, (r as any).user.id); }
  @Post('cart') addToCart(@Body() d: any, @CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.addToCart(t.id, (r as any).user.id, d.productId, d.quantity); }
  @Delete('cart/:productId') removeFromCart(@Param('productId') pid: string, @CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.removeFromCart(t.id, (r as any).user.id, pid); }
  @Post('orders') createOrder(@CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.createOrder(t.id, (r as any).user.id); }
  @Get('orders') listOrders(@CurrentTenant() t: TenantContext, @Req() r: Request) { const role = (r as any).tenant?.userRole; return this.svc.listOrders(t.id, role === 'student' ? (r as any).user.id : undefined); }
  @Get('orders/:id') getOrder(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.getOrder(t.id, id); }
}
