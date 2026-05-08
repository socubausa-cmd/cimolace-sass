import { Controller, Get, Post, Body, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { BillingService } from "./billing.service";

@Controller("billing")
@UseGuards(JwtAuthGuard, TenantGuard)
export class BillingController {
  constructor(private svc: BillingService) {}
  @Get("subscription") async getSubscription(@Req() req: any) { return { data: await this.svc.getSubscription(req.tenant.id) }; }
  @Post("subscription") async create(@Req() req: any, @Body() b: any) { return { data: await this.svc.createSubscription(req.tenant.id, b.plan, b.provider) }; }
  @Get("invoices") async getInvoices(@Req() req: any) { return { data: await this.svc.getInvoices(req.tenant.id) }; }
}
