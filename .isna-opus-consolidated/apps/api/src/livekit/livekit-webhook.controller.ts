import { Controller, Post, Req, Headers } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { LiveKitWebhookService } from './livekit-webhook.service';

@Controller('webhooks')
export class LiveKitWebhookController {
  constructor(private readonly webhookService: LiveKitWebhookService) {}

  @Post('livekit')
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('authorization') authorization?: string,
  ): Promise<{ ok: boolean }> {
    const rawBody =
      typeof req.rawBody === 'string'
        ? req.rawBody
        : req.rawBody
          ? Buffer.from(req.rawBody).toString('utf-8')
          : JSON.stringify(req.body ?? {});

    await this.webhookService.handle(rawBody, authorization ?? '');
    return { ok: true };
  }
}
