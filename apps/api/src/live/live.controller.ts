import { Controller, Get, Post, Param, Body, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { LiveService } from "./live.service";

// Rôles au niveau MÉTHODE : la CRÉATION et les contrôles HÔTE d'un live
// (créer/démarrer/terminer/enregistrer/publier le replay) = owner/admin/teacher
// (spec Billing/Rôles §matrice ; un student ne crée PAS de live). Restent ouverts
// à tout membre : lister/consulter les lives et générer SON token de participation
// (generateToken tranche host vs student côté serveur — cf. commentaire plus bas).
@Controller("lives")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class LiveController {
  constructor(private svc: LiveService) {}
  @Post() @Roles("owner", "admin", "teacher") async create(@Req() req: any, @Body() b: any) { return { data: await this.svc.createSession(req.tenant.id, b) }; }
  @Get() async findAll(@Req() req: any) { return { data: await this.svc.findAll(req.tenant.id) }; }
  @Get(":id") async findOne(@Req() req: any, @Param("id") id: string) { return { data: await this.svc.findOne(req.tenant.id, id) }; }
  // ⚠️ b.role n'est qu'un indice (hint) côté client ; le rôle EFFECTIF (host vs
  // student) est tranché côté serveur dans generateToken à partir de l'identité
  // (host_user_id de la session + rôle tenant). On passe req.tenant pour ça.
  @Post(":id/token") async token(@Req() req: any, @Param("id") id: string, @Body() b: any) { return { data: await this.svc.generateToken(id, req.user.id, b?.role, req.tenant) }; }
  @Post(":id/start") @Roles("owner", "admin", "teacher") async start(@Req() req: any, @Param("id") id: string) { return { data: await this.svc.startSession(req.tenant.id, id) }; }
  @Post(":id/end") @Roles("owner", "admin", "teacher") async end(@Req() req: any, @Param("id") id: string) { return { data: await this.svc.endSession(req.tenant.id, id) }; }
  @Post(":id/recording/start") @Roles("owner", "admin", "teacher") async recStart(@Req() req: any, @Param("id") id: string) { return { data: await this.svc.startRecording(req.tenant.id, id) }; }
  @Post(":id/recording/stop") @Roles("owner", "admin", "teacher") async recStop(@Req() req: any, @Param("id") id: string) { return { data: await this.svc.stopRecording(req.tenant.id, id) }; }
  // Revue hôte : approuver le brouillon de replay (→ 'published', visible élève) / le retirer.
  @Post(":id/replay/publish") @Roles("owner", "admin", "teacher") async replayPublish(@Req() req: any, @Param("id") id: string) { return { data: await this.svc.publishReplay(req.tenant.id, id, { force: "published", actorId: req.user.id }) }; }
  @Post(":id/replay/unpublish") @Roles("owner", "admin", "teacher") async replayUnpublish(@Req() req: any, @Param("id") id: string) { return { data: await this.svc.unpublishReplay(req.tenant.id, id, req.user.id) }; }
}
