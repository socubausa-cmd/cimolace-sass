import {
  Controller, Get, Post, Param, Body, Req, UseGuards,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SocialPublisherService } from './social-publisher.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PublishShortDto, SaveSocialTokenDto } from './dto/social-publisher.dto';

// Publication sociale + tokens OAuth = actions STAFF/créateur uniquement. RolesGuard au niveau
// classe (avec TenantGuard qui peut poser userRole=null pour un non-membre → sinon un non-membre
// aurait pu enregistrer/hijacker un token social du tenant).
@ApiTags('Social Publisher')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('owner', 'admin', 'teacher')
@Controller('social-publisher')
export class SocialPublisherController {
  constructor(
    private readonly service: SocialPublisherService,
    private readonly supabase: SupabaseService,
  ) {}

  /* ─── Tokens ──────────────────────────────────────────────────────────── */

  @Post('tokens')
  @ApiOperation({ summary: 'Sauvegarder un token OAuth social' })
  async saveToken(@Req() req: any, @Body() dto: SaveSocialTokenDto) {
    const tenantId = req.tenant?.id;
    await this.service.saveToken(tenantId, dto);
    return { message: 'Token sauvegardé' };
  }

  @Get('tokens')
  @ApiOperation({ summary: 'Lister les tokens sociaux configurés' })
  async getTokens(@Req() req: any) {
    const tenantId = req.tenant?.id;
    return this.service.getTokens(tenantId);
  }

  /* ─── Brouillons / Publication ───────────────────────────────────────── */

  @Post('draft')
  @ApiOperation({ summary: 'Créer un brouillon de publication' })
  async createDraft(@Req() req: any, @Body() dto: PublishShortDto) {
    const tenantId = req.tenant?.id;
    return this.service.createDraft(tenantId, dto);
  }

  @Get('posts')
  @ApiOperation({ summary: 'Lister les posts (brouillons + publiés)' })
  async listPosts(@Req() req: any) {
    const tenantId = req.tenant?.id;
    return this.service.listPosts(tenantId);
  }

  @Post('publish/:postId/tiktok')
  @ApiOperation({ summary: 'Publier un post sur TikTok' })
  async publishTikTok(@Req() req: any, @Param('postId') postId: string) {
    const tenantId = req.tenant?.id;
    const success = await this.service.publishToTikTok(tenantId, postId);
    return { success, message: success ? 'Publié sur TikTok ✅' : 'Échec publication TikTok ❌' };
  }

  @Post('publish/:postId/facebook')
  @ApiOperation({ summary: 'Publier un post sur Facebook' })
  async publishFacebook(@Req() req: any, @Param('postId') postId: string) {
    const tenantId = req.tenant?.id;
    const success = await this.service.publishToFacebook(tenantId, postId);
    return { success, message: success ? 'Publié sur Facebook ✅' : 'Échec publication Facebook ❌' };
  }

  @Post('publish/:postId/instagram')
  @ApiOperation({ summary: 'Publier un post sur Instagram (via Meta)' })
  async publishInstagram(@Req() req: any, @Param('postId') postId: string) {
    const tenantId = req.tenant?.id;
    const success = await this.service.publishToInstagram(tenantId, postId);
    return { success, message: success ? 'Publié sur Instagram ✅' : 'Échec publication Instagram ❌' };
  }

  @Post('publish/:postId/linkedin')
  @ApiOperation({ summary: 'Publier un post sur LinkedIn' })
  async publishLinkedIn(@Req() req: any, @Param('postId') postId: string) {
    const tenantId = req.tenant?.id;
    const success = await this.service.publishToLinkedIn(tenantId, postId);
    return { success, message: success ? 'Publié sur LinkedIn ✅' : 'Échec publication LinkedIn ❌' };
  }

  @Post('publish/:postId/all')
  @ApiOperation({ summary: 'Publier sur toutes les plateformes configurées' })
  async publishAll(@Req() req: any, @Param('postId') postId: string) {
    const tenantId = req.tenant?.id;
    return this.service.publishAll(tenantId, postId);
  }

  /* ─── Shorts ──────────────────────────────────────────────────────────── */

  @Get('shorts')
  @ApiOperation({ summary: 'Lister les shorts générés pour publication' })
  async listShorts(@Req() req: any) {
    const tenantId = req.tenant?.id;
    const { data } = await (this.supabase.client as any)
      .from('short_clips')
      .select('*, recording:recording_id(id, topic)')
      .eq('tenant_id', tenantId)
      .eq('status', 'ready')
      .order('created_at', { ascending: false });
    return data || [];
  }
}
