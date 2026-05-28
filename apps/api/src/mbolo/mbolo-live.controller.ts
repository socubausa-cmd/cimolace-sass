import {
  Controller,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { MboloLiveService } from './mbolo-live.service';

/**
 * Mbolo Live Shopping — public API. Issues / ends a Liri-backed video
 * session tied to a product. Proof point that the Liri pattern works for
 * non-medical engines.
 */
@Controller('mbolo/products/:productId/live')
@UseGuards(JwtAuthGuard, TenantGuard)
export class MboloLiveController {
  constructor(private readonly svc: MboloLiveService) {}

  /**
   * POST /mbolo/products/:productId/live/join?role=seller|viewer
   * Returns { sessionId, room, token, url, ttl, purpose }.
   */
  @Post('join')
  async join(
    @Req() req: any,
    @Param('productId') productId: string,
    @Query('role') role: 'seller' | 'viewer' = 'viewer',
  ) {
    return {
      data: await this.svc.joinProductLive(
        req.tenant,
        req.user.id,
        productId,
        role,
        req.user.email,
      ),
    };
  }

  /** POST /mbolo/products/:productId/live/end */
  @Post('end')
  async end(@Req() req: any, @Param('productId') productId: string) {
    return { data: await this.svc.endProductLive(req.tenant, productId) };
  }
}
