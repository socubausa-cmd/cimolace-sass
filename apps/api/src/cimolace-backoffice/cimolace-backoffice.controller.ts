import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CimolaceStaffGuard } from './cimolace-staff.guard';
import { CimolaceBackofficeService } from './cimolace-backoffice.service';
import { CreateClientDto, UpdateClientDto } from './dto/backoffice.dto';

@Controller('cimolace-backoffice')
@UseGuards(JwtAuthGuard, CimolaceStaffGuard)
export class CimolaceBackofficeController {
  constructor(private readonly svc: CimolaceBackofficeService) {}

  @Get('stats') getStats() { return this.svc.getStats(); }

  // ─── Finances plateforme (console SaaS : vrais soldes wallet pawaPay + retrait) ──
  @Get('finances') getFinances() { return this.svc.getPlatformFinances(); }
  @Get('finances/payouts') listFinancePayouts() { return this.svc.getPlatformPayouts(); }
  @Post('finances/payout') createFinancePayout(@Req() req: any, @Body() b: any) { return this.svc.createPlatformPayout(req.user?.id ?? null, b); }
  // Porte-monnaie par produit (afritrack, liri, mbolo, medos…)
  @Get('finances/wallets') listWallets() { return this.svc.listWallets(); }
  @Post('finances/wallets') createWallet(@Body() b: any) { return this.svc.createWallet(b); }
  @Post('finances/wallets/:key/allocate') allocateWallet(@Req() req: any, @Param('key') key: string, @Body() b: any) { return this.svc.allocateWallet(key, b, req.user?.id ?? null); }
  // Rail Airtel Money (décaissement direct — sandbox par défaut)
  @Post('finances/airtel/disburse') airtelDisburse(@Req() req: any, @Body() b: any) { return this.svc.airtelDisburse(req.user?.id ?? null, b); }
  @Get('finances/airtel/status/:id') airtelStatus(@Param('id') id: string) { return this.svc.airtelStatus(id); }

  @Get('clients') listClients() { return this.svc.listClients(); }
  @Post('clients') createClient(@Body() d: CreateClientDto) { return this.svc.createClient(d); }
  @Patch('clients/:id') updateClient(@Req() req: any, @Param('id') id: string, @Body() d: UpdateClientDto) { return this.svc.updateClient(id, d, req.user?.email ?? req.user?.id ?? undefined); }
  @Get('sites') listSites() { return this.svc.listSites(); }
  @Get('clients/:clientId/sites') getClientSites(@Param('clientId') cid: string) { return this.svc.getClientSites(cid); }
  @Get('clients/:id/control-plane') getControlPlane(@Param('id') id: string) { return this.svc.getClientControlPlane(id); }
  @Get('clients/:id/diagnostics') getDiagnostics(@Param('id') id: string) { return this.svc.getClientDiagnostics(id); }
  @Post('clients/:id/invoices') createInvoice(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.svc.createTenantInvoice(id, body, req.user?.email ?? req.user?.id ?? undefined); }
  @Patch('clients/:clientId/services/:serviceId') updateService(@Req() req: any, @Param('clientId') cid: string, @Param('serviceId') sid: string, @Body() body: any) { return this.svc.updateTenantService(cid, sid, body, req.user?.email ?? req.user?.id ?? undefined); }
  @Post('clients/:id/operations') runOperation(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.svc.runTenantOperation(id, body, req.user?.email ?? req.user?.id ?? undefined); }
  @Post('clients/:id/tickets') createTicket(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.svc.createTenantTicket(id, body, req.user?.email ?? req.user?.id ?? undefined); }

  // ─── Impersonation encadrée (§15) — motif obligatoire, durée bornée, log début+fin ───
  @Post('clients/:id/impersonate') startImpersonation(@Req() req: any, @Param('id') id: string, @Body() body: { reason?: string; durationMinutes?: number; role?: string }) { return this.svc.startImpersonation({ id: req.user?.id, email: req.user?.email }, id, body || {}); }
  @Post('clients/:id/impersonate/end') endImpersonation(@Req() req: any, @Param('id') id: string, @Body() body: { reason?: string }) { return this.svc.endImpersonation({ id: req.user?.id, email: req.user?.email }, id, body || {}); }
  @Get('impersonations/active') activeImpersonations() { return this.svc.listActiveImpersonations(); }
  @Post('clients/:id/credentials') createCredential(@Param('id') id: string, @Body() body: any) { return this.svc.createCredentialReference(id, body); }
  @Post('clients/:clientId/credentials/:credentialId/rotate') rotateCredential(@Param('clientId') cid: string, @Param('credentialId') credId: string, @Body() body: any) { return this.svc.rotateCredential(cid, credId, body); }
  @Post('clients/:id/school-model/activate-engines') smEngines(@Param('id') id: string, @Body() body: any) { return this.svc.activateSchoolModelEngines(id, body); }
  @Post('clients/:id/school-model/prepare') smPrepare(@Param('id') id: string, @Body() body: any) { return this.svc.prepareSchoolModel(id, body); }
  @Post('clients/:id/school-model/apply-quotas') smQuotas(@Param('id') id: string, @Body() body: any) { return this.svc.applySchoolModelQuotas(id, body); }
  @Post('clients/:id/school-model/prepare-providers') smProviders(@Param('id') id: string, @Body() body: any) { return this.svc.prepareSchoolModelProviders(id, body); }
  @Get('monitoring/overview') monitoringOverview() { return this.svc.getMonitoringOverview(); }
  @Post('monitoring/run-all') monitoringRunAll() { return this.svc.runAllHealthChecks(); }
}
