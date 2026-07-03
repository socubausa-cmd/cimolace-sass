import { Body, Controller, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ApiKeyGuard } from '../../auth/api-key.guard';
import type { TenantContext } from '../../tenant/tenant.types';
import { ServerTokenDto } from './dto/server-token.dto';
import { EmbedService } from './embed.service';

type IssueEmbedTokenDto = {
  tenant_slug: string;
  mode: string;
  // NB : PAS de patient_user_id ici. Le Niveau 1 est anonyme (validé par la seule
  // Origin) ; fixer un patient est réservé au Niveau 2 (server-token, clé mdk_).
  // Un patient_user_id envoyé ici serait IGNORÉ côté service (anti-IDOR/PHI).
};

type ApiKeyRequest = Request & {
  tenant: TenantContext;
  apiKeyId: string;
};

/**
 * Endpoints d'émission de JWT embed-token.
 *
 *  - POST /v1/medos/embed/token        (Niveau 1, anonyme, CORS Origin)
 *  - POST /v1/medos/embed/server-token (Niveau 2, identifié, clé API tenant)
 */
@ApiTags('MedOS — Embed')
@Controller('v1/medos/embed')
export class MedosEmbedController {
  constructor(private readonly embedService: EmbedService) {}

  /** Niveau 1 — Token anonyme, validé par Origin whitelisté */
  @Post('token')
  async issue(
    @Body() dto: IssueEmbedTokenDto,
    @Headers('origin') origin: string | undefined,
  ) {
    return this.embedService.issueEmbedToken({
      tenantSlug: dto.tenant_slug,
      mode: dto.mode,
      origin,
    });
  }

  /**
   * Niveau 2 — Token identifié, validé par clé API tenant (server-to-server).
   *
   * Appelé par le backend d'un site tenant (ex: zahirwellness.com) pour
   * obtenir un JWT qui ouvre directement le dossier du patient passé en
   * paramètre — sans login utilisateur dans le widget.
   *
   * Auth : `Authorization: Bearer mdk_<tenant>_<secret>` (clé API tenant).
   * Crée automatiquement le user + dossier patient si n'existent pas.
   */
  @Post('server-token')
  @UseGuards(ApiKeyGuard)
  @ApiBearerAuth()
  async issueServerToken(
    @Body() dto: ServerTokenDto,
    @Req() req: ApiKeyRequest,
  ) {
    return this.embedService.issueServerToken({
      tenant: req.tenant,
      apiKeyId: req.apiKeyId,
      patient_email: dto.patient_email,
      patient_first_name: dto.patient_first_name,
      patient_last_name: dto.patient_last_name,
      external_user_id: dto.external_user_id,
      mode: dto.mode,
    });
  }

  /**
   * Niveau 2 — SSO PRATICIEN. Le backend du tenant (clé API) demande un code
   * à usage unique pour le praticien connecté chez lui. Le tenant charge
   * ensuite `med.cimolace.space/handoff?code=…` dans une iframe → le dashboard
   * MEDOS s'ouvre déjà authentifié, sans que le praticien quitte son site.
   */
  @Post('practitioner-token')
  @UseGuards(ApiKeyGuard)
  @ApiBearerAuth()
  async issuePractitionerToken(
    @Body() dto: { practitioner_email: string },
    @Req() req: ApiKeyRequest,
  ) {
    return this.embedService.mintPractitionerHandoff(
      req.tenant,
      dto.practitioner_email,
    );
  }
}
