import { Controller, Get, Param, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { LiveService } from "./live.service";

/**
 * Endpoint de LECTURE du replay, consommé par le <video> du front (via un fetch
 * Bearer qui récupère l'URL présignée, puis joue la vidéo).
 *
 * Garde : JwtAuthGuard SEUL — PAS TenantGuard. Le <video>/fetch ne peut pas
 * porter le header `X-Tenant-Slug` ; le tenant et le contrôle d'accès sont donc
 * dérivés de la session côté service (resolveReplayPlaybackUrl → canViewReplay,
 * fail-closed). On ne met JAMAIS le JWT dans l'URL du <video> (fuite) : le front
 * fetche cet endpoint avec l'en-tête Authorization, récupère { url } et n'expose
 * que l'URL R2 présignée (scopée, à TTL court) dans la balise vidéo.
 */
@Controller("lives")
@UseGuards(JwtAuthGuard)
export class LiveReplayFileController {
  constructor(private svc: LiveService) {}

  @Get(":id/replay/file")
  async file(@Req() req: any, @Param("id") id: string) {
    return { url: await this.svc.resolveReplayPlaybackUrl(id, req.user.id) };
  }
}
