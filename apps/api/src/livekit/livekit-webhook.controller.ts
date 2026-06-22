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
    // `req.body` est le Buffer brut posé par le parser `raw()` dédié (main.ts).
    // Fallbacks : req.rawBody (NestFactory rawBody:true) puis re-sérialisation.
    // `req.body` est le Buffer brut posé par le parser `raw()` dédié (main.ts).
    // Fallbacks : req.rawBody (NestFactory rawBody:true) puis re-sérialisation.
    const rawBody = Buffer.isBuffer(req.body)
      ? (req.body as Buffer).toString('utf-8')
      : typeof req.rawBody === 'string'
        ? req.rawBody
        : req.rawBody
          ? Buffer.from(req.rawBody).toString('utf-8')
          : JSON.stringify(req.body ?? {});

    await this.webhookService.handle(rawBody, authorization ?? '');
    return { ok: true };
  }
}
