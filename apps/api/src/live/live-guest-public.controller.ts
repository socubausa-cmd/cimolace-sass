import { Body, Controller, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { LiveService } from "./live.service";

/**
 * PUBLIC (sans JWT) — join invité d'un live PAYANT via un jeton d'URL (= id d'un
 * access_pass `live_session`), créé après paiement sur le SITE du tenant. Contrôleur
 * SÉPARÉ sans JwtAuthGuard, comme le contrôleur public "proche" du téléconsult.
 * ADDITIF : ne touche pas au live.controller (JWT) ni à generateToken.
 */
@ApiTags("Live — invité public (live payant)")
@Controller("lives-public")
export class LiveGuestPublicController {
  constructor(private readonly svc: LiveService) {}

  /** Token vidéo invité (canSubscribe) si l'access_pass est valide pour cette session. */
  @Post(":id/guest-token")
  async guestToken(
    @Param("id") id: string,
    @Body() body: { invite_id?: string; tenant?: string },
  ) {
    return this.svc.generateGuestLiveToken(id, String(body?.invite_id || ""), body?.tenant);
  }

  /**
   * Métadonnées publiques de la session pour l'ÉCRAN DE CONNEXION invité (salle d'attente
   * brandée) — SANS token LiveKit, SANS effet de bord room/forfait. Valide le même
   * access_pass. Le `invite_id` passe dans le CORPS (jamais en query string).
   */
  @Post(":id/info")
  async guestInfo(
    @Param("id") id: string,
    @Body() body: { invite_id?: string; tenant?: string },
  ) {
    return this.svc.getPublicGuestInfo(id, String(body?.invite_id || ""), body?.tenant);
  }
}
