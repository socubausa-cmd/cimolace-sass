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
  @Get('clients') listClients() { return this.svc.listClients(); }
  @Post('clients') createClient(@Body() d: CreateClientDto) { return this.svc.createClient(d); }
  @Patch('clients/:id') updateClient(@Param('id') id: string, @Body() d: UpdateClientDto) { return this.svc.updateClient(id, d); }
  @Get('sites') listSites() { return this.svc.listSites(); }
  @Get('clients/:clientId/sites') getClientSites(@Param('clientId') cid: string) { return this.svc.getClientSites(cid); }
  @Get('clients/:id/control-plane') getControlPlane(@Param('id') id: string) { return this.svc.getClientControlPlane(id); }
  @Get('clients/:id/diagnostics') getDiagnostics(@Param('id') id: string) { return this.svc.getClientDiagnostics(id); }
  @Post('clients/:id/invoices') createInvoice(@Param('id') id: string, @Body() body: any) { return this.svc.createTenantInvoice(id, body); }
  @Patch('clients/:clientId/services/:serviceId') updateService(@Param('clientId') cid: string, @Param('serviceId') sid: string, @Body() body: any) { return this.svc.updateTenantService(cid, sid, body); }
  @Post('clients/:id/operations') runOperation(@Param('id') id: string, @Body() body: any) { return this.svc.runTenantOperation(id, body); }
  @Post('clients/:id/tickets') createTicket(@Param('id') id: string, @Body() body: any) { return this.svc.createTenantTicket(id, body); }
}
