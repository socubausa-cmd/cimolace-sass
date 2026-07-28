import { Module } from "@nestjs/common";
import { AuthModule } from "./auth.module";
import { EmailEngineModule } from "../email-engine/email-engine.module";
import { PasswordResetController } from "./password-reset.controller";
import { PasswordResetService } from "./password-reset.service";

/**
 * Module SÉPARÉ, et c'est délibéré : brancher ces deux dépendances directement
 * dans AuthModule créait un cycle — AuthModule → EmailEngineModule →
 * TenantModule → AuthModule — que Nest ne sait pas résoudre. L'application ne
 * démarrait plus (healthcheck Railway en échec, déploiement refusé).
 *
 * Ici le sens est unique : ce module consomme les deux, personne ne le consomme.
 */
@Module({
  imports: [AuthModule, EmailEngineModule],
  controllers: [PasswordResetController],
  providers: [PasswordResetService],
})
export class PasswordResetModule {}
