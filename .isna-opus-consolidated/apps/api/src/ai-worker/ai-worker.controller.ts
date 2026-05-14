import {
  Controller, Get, Post, Param, Body, UseGuards,
} from '@nestjs/common';
import { AiWorkerService } from './ai-worker.service';
import { EnqueueJobDto } from './dto/enqueue-job.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import type { TenantContext } from '../tenant/tenant.types';

@Controller('ai-worker')
@UseGuards(JwtAuthGuard)
export class AiWorkerController {
  constructor(private readonly svc: AiWorkerService) {}

  @Post('jobs')
  enqueue(@Body() dto: EnqueueJobDto, @CurrentTenant() t: TenantContext) {
    return this.svc.enqueue(t.id, dto);
  }

  @Get('jobs')
  list(@CurrentTenant() t: TenantContext) {
    return this.svc.listJobs(t.id);
  }

  @Get('jobs/:id')
  get(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return this.svc.getJob(t.id, id);
  }

  @Post('renewal-cycle') processRenewal() { return this.svc.processRenewalCycle(); }
  @Post('dlq') processDlq() { return this.svc.processDlq(); }
  @Post('expire-subs') processExpired() { return this.svc.processExpiredSubscriptions(); }
}
