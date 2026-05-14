import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CimolaceBackofficeService } from './cimolace-backoffice.service';
import { CreateClientDto, UpdateClientDto } from './dto/backoffice.dto';

@Controller('cimolace/admin')
@UseGuards(JwtAuthGuard)
export class CimolaceBackofficeController {
  constructor(private readonly svc: CimolaceBackofficeService) {}

  @Get('stats') getStats() { return this.svc.getStats(); }
  @Get('clients') listClients() { return this.svc.listClients(); }
  @Post('clients') createClient(@Body() d: CreateClientDto) { return this.svc.createClient(d); }
  @Patch('clients/:id') updateClient(@Param('id') id: string, @Body() d: UpdateClientDto) { return this.svc.updateClient(id, d); }
  @Get('sites') listSites() { return this.svc.listSites(); }
  @Get('clients/:clientId/sites') getClientSites(@Param('clientId') cid: string) { return this.svc.getClientSites(cid); }
}
