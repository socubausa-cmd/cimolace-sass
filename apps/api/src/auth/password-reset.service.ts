import { Injectable, Logger } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { EmailEngineService } from "../email-engine/email-engine.service";

/**
 * Réinitialisation de mot de passe MARQUÉE PAR TENANT.
 *
 * Supabase sait envoyer ce mail tout seul, mais avec SON gabarit : « Reset Your
 * Password », en anglais, expédié par noreply@mail.app.supabase.io. Sur une
 * plateforme multi-tenant c'est doublement faux — ni la langue, ni la marque de
 * l'école ne correspondent, et un gabarit unique dans le tableau de bord ne
 * pourrait de toute façon pas servir plusieurs tenants à la fois.
 *
 * On génère donc le lien côté serveur (`admin.generateLink`, qui N'ENVOIE RIEN)
 * puis on l'expédie par le moteur d'e-mail du tenant, qui porte déjà sa clé
 * Resend, son expéditeur et son habillage.
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly auth: AuthService,
    private readonly email: EmailEngineService,
  ) {}

  private get supabase() {
    return this.auth.getClient();
  }

  /** Tenant par slug — route publique, donc résolution sans membership. */
  private async tenantBySlug(slug: string) {
    const { data } = await this.supabase
      .from("tenants")
      .select("id, name, slug")
      .eq("slug", slug)
      .maybeSingle();
    return (data as { id: string; name?: string; slug?: string } | null) ?? null;
  }

  /**
   * Envoie le lien. Retourne TOUJOURS le même résultat, que le compte existe ou
   * non : répondre différemment permettrait d'énumérer les adresses inscrites.
   */
  async request(input: { email: string; tenantSlug: string; redirectTo: string }) {
    const email = String(input.email ?? "").trim().toLowerCase();
    const ok = { sent: true };
    if (!email || !email.includes("@")) return ok;

    try {
      const tenant = await this.tenantBySlug(input.tenantSlug);
      if (!tenant) return ok;

      // `generateLink` fabrique le lien SANS l'expédier — c'est ce qui nous rend
      // l'envoi. ⚠️ En REST, `redirect_to` est à la RACINE du corps ; passé sous
      // `options` il est ignoré et Supabase retombe sur le Site URL du projet.
      const { data, error } = await this.supabase.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: input.redirectTo },
      } as never);
      // Compte inconnu : on sort en silence, avec la même réponse.
      if (error || !data) return ok;

      const link =
        (data as { properties?: { action_link?: string }; action_link?: string })
          ?.properties?.action_link ??
        (data as { action_link?: string })?.action_link;
      if (!link) return ok;

      const brand = tenant.name || "LIRI";
      const html = this.email.brandedHtml({
        brand,
        title: "Réinitialiser votre mot de passe",
        body:
          "Vous avez demandé un nouveau mot de passe. Ce lien est valable une heure " +
          "et ne peut servir qu'une fois. Si vous n'êtes pas à l'origine de cette " +
          "demande, ignorez ce message : votre mot de passe actuel reste valable.",
        ctaLabel: "Choisir un nouveau mot de passe",
        ctaUrl: link,
      });

      await this.email.sendRaw(
        tenant.id,
        email,
        `Réinitialiser votre mot de passe ${brand}`,
        html,
      );
    } catch (e) {
      // Jamais de détail au client : il apprendrait si l'adresse existe.
      this.logger.warn(`password reset: ${(e as Error).message}`);
    }
    return ok;
  }
}
