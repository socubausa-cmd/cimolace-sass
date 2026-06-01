import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { MultilangService } from './multilang.service';

@ApiTags('Multilang')
@ApiBearerAuth()
@Controller('multilang')
@UseGuards(JwtAuthGuard, TenantGuard)
export class MultilangController {
  constructor(private readonly svc: MultilangService) {}

  @Post('translate')
  async translate(@Body() d: any) {
    return this.svc.translateContent(
      d.content,
      d.targetLang || 'en',
      d.sourceLang,
    );
  }

  @Post('live')
  async multilangLive(@Body() d: any) {
    return this.svc.multilangLive(
      d.transcript || '',
      d.targetLangs || ['en', 'fr'],
    );
  }

  @Post('video')
  async multilangVideo(@Body() d: any) {
    return this.svc.multilangVideo(
      d.content || '',
      d.targetLangs || ['en'],
      d.title,
    );
  }
}
