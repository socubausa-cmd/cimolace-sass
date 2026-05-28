import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EmbedService } from './embed.service';

type IssueEmbedTokenDto = {
  tenant_slug: string;
  mode: string;
  /** Optionnel : pour les modes patient-portal, identifiant du patient à charger.
   *  Si absent, le widget tombera sur un mode 'public' qui demande au patient
   *  de s'identifier via magic link. */
  patient_user_id?: string;
};

/**
 * Endpoint public (CORS dynamique) qui émet un JWT embed-token court-vivant.
 *
 * Appelé par embed.js depuis le navigateur du visiteur — pas de clé secrète,
 * la confiance vient du couple (Origin HTTP + tenant_slug + tenant_domains).
 *
 * Si tu veux un mode "patient connecté" (sub = patient_user_id), le client
 * DOIT relayer l'appel depuis son backend avec sa clé API tenant pour prouver
 * l'identité — voir POST /v1/medos/embed/server-token (à venir S2).
 */
@ApiTags('MedOS — Embed')
@Controller('v1/medos/embed')
export class MedosEmbedController {
  constructor(private readonly embedService: EmbedService) {}

  @Post('token')
  async issue(
    @Body() dto: IssueEmbedTokenDto,
    @Headers('origin') origin: string | undefined,
  ) {
    return this.embedService.issueEmbedToken({
      tenantSlug: dto.tenant_slug,
      mode: dto.mode,
      origin,
      requestedPatientUserId: dto.patient_user_id ?? null,
    });
  }
}
