import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { LiriEntitlementsService } from "./liri-entitlements.service";

/**
 * Module léger exposant LiriEntitlementsService (palier + limites LIRI d'un
 * tenant). Isolé du gros BillingModule (PawaPay, webhooks…) pour pouvoir être
 * importé partout où l'on doit ENFORCER une limite (moteur live, replay,
 * smartboard IA…) sans tirer toute la plomberie de facturation.
 */
@Module({
  imports: [AuthModule],
  providers: [LiriEntitlementsService],
  exports: [LiriEntitlementsService],
})
export class LiriEntitlementsModule {}
