import {
  Controller, Get, Post, Patch, Delete, Param, Query, Body, Req, Headers, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ZoomEngineService } from './zoom-engine.service';
import { ZoomOAuthService } from './zoom-oauth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { SyncRecordingsDto, UpdateRecordingDto, PublishVideoDto } from './dto/zoom-recordings.dto';

@ApiTags('Zoom Engine')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('zoom-engine')
export class ZoomEngineController {
  constructor(
    private readonly service: ZoomEngineService,
    private readonly oauth: ZoomOAuthService,
  ) {}

  /* ─── OAuth ─────────────────────────────────────────────────────────── */

  @Get('auth/url')
  @ApiOperation({ summary: 'Obtenir l\'URL de connexion Zoom OAuth' })
  getAuthUrl(@Req() req: any) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId || !userId) throw new Error('Tenant ou utilisateur non identifié');
    return { url: this.oauth.getAuthorizationUrl(tenantId, userId) };
  }

  @Get('oauth/callback')
  @ApiOperation({ summary: 'Callback OAuth Zoom (interne)' })
  async oauthCallback(@Query('code') code: string, @Query('state') state: string) {
    await this.oauth.handleCallback(code, state);
    return { message: 'Compte Zoom connecté avec succès ✅ Vous pouvez fermer cette fenêtre.' };
  }

  @Get('auth/status')
  @ApiOperation({ summary: 'Vérifier si Zoom est connecté' })
  async authStatus(@Req() req: any) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const connected = await this.oauth.isConnected(tenantId);
    return { connected };
  }

  @Post('auth/disconnect')
  @ApiOperation({ summary: 'Déconnecter Zoom' })
  async disconnect(@Req() req: any) {
    const tenantId = req.tenantId || req.user?.tenantId;
    await this.oauth.disconnect(tenantId);
    return { message: 'Compte Zoom déconnecté' };
  }

  /* ─── Synchronisation ──────────────────────────────────────────────── */

  @Get('token-proxy/:tenantId')
  @ApiOperation({ summary: 'Proxy interne worker : retourne un token Zoom valide' })
  async tokenProxy(
    @Param('tenantId') tenantId: string,
    @Headers('x-api-service-key') serviceKey: string,
  ) {
    const expectedKey = process.env.API_SERVICE_KEY;
    if (!expectedKey || serviceKey !== expectedKey) {
      throw new Error('Clé de service invalide');
    }
    const access_token = await this.oauth.getValidToken(tenantId);
    return { access_token };
  }

  @Post('sync')
  @ApiOperation({ summary: 'Lancer une synchronisation des enregistrements Zoom' })
  async sync(@Req() req: any, @Body() dto: SyncRecordingsDto) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.service.syncRecordings(tenantId, dto.days || 30);
  }

  @Get('sync-logs')
  @ApiOperation({ summary: 'Historique des synchronisations' })
  async syncLogs(@Req() req: any, @Query('limit') limit?: number) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.service.getSyncLogs(tenantId, limit || 10);
  }

  /* ─── CRUD Enregistrements ─────────────────────────────────────────── */

  @Get('recordings')
  @ApiOperation({ summary: 'Lister les enregistrements' })
  async listRecordings(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('is_published') is_published?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.service.listRecordings(tenantId, {
      status,
      is_published: is_published === 'true' ? true : is_published === 'false' ? false : undefined,
      limit: limit || 50,
      offset: offset || 0,
    });
  }

  @Get('recordings/:id')
  @ApiOperation({ summary: 'Détail d\'un enregistrement' })
  async getRecording(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.service.getRecording(tenantId, id);
  }

  @Patch('recordings/:id')
  @ApiOperation({ summary: 'Modifier un enregistrement (catégorie, tags, titre…)' })
  async updateRecording(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateRecordingDto) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.service.updateRecording(tenantId, id, dto);
  }

  @Delete('recordings/:id')
  @ApiOperation({ summary: 'Supprimer un enregistrement' })
  async deleteRecording(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user?.tenantId;
    await this.service.deleteRecording(tenantId, id);
    return { message: 'Enregistrement supprimé' };
  }

  /* ─── Publication site public ──────────────────────────────────────── */

  @Post('publish')
  @ApiOperation({ summary: 'Publier une vidéo sur le site public' })
  async publishVideo(@Req() req: any, @Body() dto: PublishVideoDto) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.service.publishVideo(tenantId, dto);
  }

  @Get('published')
  @UseGuards(TenantGuard)
  @ApiOperation({ summary: 'Lister les vidéos publiées' })
  async listPublished(@Req() req: any) {
    // La Vidéothèque est lue par les ÉLÈVES : le tenant vient du header X-Tenant-Slug résolu par
    // TenantGuard (req.tenant.id), PAS de req.tenantId (jamais posé sur ce controller sans
    // TenantGuard) ni req.user.tenantId (absent pour un élève). Sans ça, listPublishedVideos
    // recevait `undefined` → `where tenant_id = undefined` → 0 vidéo malgré les replays publiés.
    const tenantId = req.tenant?.id || req.tenantId || req.user?.tenantId;
    return this.service.listPublishedVideos(tenantId);
  }

  @Post('unpublish/:id')
  @ApiOperation({ summary: 'Dépublier une vidéo' })
  async unpublishVideo(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user?.tenantId;
    await this.service.unpublishVideo(id);
    return { message: 'Vidéo dépubliée' };
  }
}
