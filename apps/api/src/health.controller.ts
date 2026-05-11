import { Controller, Get } from '@nestjs/common';
import { SkipResponseWrapper } from './common/decorators/skip-response-wrapper.decorator';

@Controller('health')
export class HealthController {
  @Get()
  @SkipResponseWrapper()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
