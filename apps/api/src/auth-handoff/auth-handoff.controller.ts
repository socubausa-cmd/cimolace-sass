import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SkipResponseWrapper } from '../common/decorators/skip-response-wrapper.decorator';
import { AuthHandoffService } from './auth-handoff.service';

@Controller('auth/handoff')
export class AuthHandoffController {
  constructor(private readonly svc: AuthHandoffService) {}

  /**
   * Create a one-time handoff code for the CURRENT session. The access token
   * comes from the Authorization header (already validated by JwtAuthGuard);
   * the refresh token is supplied in the body so the target app can establish
   * a full, refreshable session. Raw response (no { data } wrapper).
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @SkipResponseWrapper()
  async create(
    @Req() req: any,
    @Headers('authorization') auth: string,
    @Body() body: { refresh_token?: string },
  ) {
    const accessToken = (auth || '').replace(/^Bearer\s+/i, '').trim();
    const refreshToken = body?.refresh_token;
    if (!accessToken || !refreshToken) {
      throw new BadRequestException('access + refresh token requis');
    }
    return this.svc.createCode(req.user.id, accessToken, refreshToken);
  }

  /** Exchange a one-time code for the relayed session tokens. Public. */
  @Post('exchange')
  @SkipResponseWrapper()
  async exchange(@Body() body: { code?: string }) {
    return this.svc.exchange(String(body?.code ?? ''));
  }
}
