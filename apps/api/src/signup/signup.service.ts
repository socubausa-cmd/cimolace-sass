/**
 * SignupService — création self-serve d'un tenant LIRI/École/MedOS/etc.
 *
 * Crée en transaction logique :
 *  1. un user Supabase Auth (email + password, mail confirmé automatiquement)
 *  2. une ligne `tenants` avec infrastructure_type = kind
 *  3. une ligne `tenant_memberships` avec role = owner
 *  4. (best-effort) le solde AI Credits initial via RPC init_tenant_ai_balance
 *
 * Pas de transaction Postgres car Supabase auth.admin.createUser n'est pas dans
 * la DB côté NestJS. Si une étape échoue après l'auth, on tente un rollback du
 * user créé pour ne pas laisser de compte orphelin.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

const VALID_KINDS = [
  'liri',
  'school',
  'medos',
  'mbolo',
  'wellness',
  'creator',
  'temple',
  'community',
] as const;

type Kind = (typeof VALID_KINDS)[number];

const DEFAULT_PLAN_BY_KIND: Record<Kind, string> = {
  liri: 'free',
  school: 'free',
  medos: 'free',
  mbolo: 'free',
  wellness: 'free',
  creator: 'free',
  temple: 'free',
  community: 'free',
};

export interface SignupTenantInput {
  email: string;
  password: string;
  platformName: string;
  slug?: string;
  kind: string;
  locale?: string;
  timezone?: string;
  /** Marque générée par l'AI Brand-in-a-box (appliquée à la création). */
  brand?: {
    primary?: string;
    accent?: string;
    site?: Record<string, unknown>;
  };
}

export interface SignupTenantResult {
  tenant: { id: string; slug: string; name: string; infrastructure_type: string };
  user: { id: string; email: string };
  next_url: string;
}

@Injectable()
export class SignupService {
  private readonly logger = new Logger(SignupService.name);

  constructor(private readonly sb: SupabaseService) {}

  async signupTenant(input: SignupTenantInput): Promise<SignupTenantResult> {
    const { email, password, platformName, kind, locale = 'fr', timezone = 'Europe/Paris' } = input;

    if (!email || !password || !platformName) {
      throw new BadRequestException('email, password et platformName sont requis');
    }
    if (password.length < 8) {
      throw new BadRequestException('Le mot de passe doit faire au moins 8 caractères');
    }
    if (!VALID_KINDS.includes(kind as Kind)) {
      throw new BadRequestException(
        `kind invalide. Valeurs autorisées : ${VALID_KINDS.join(', ')}`,
      );
    }
    if (platformName.length < 2 || platformName.length > 80) {
      throw new BadRequestException('Le nom de la plateforme doit faire 2 à 80 caractères');
    }

    const slug = (input.slug?.trim() || this.slugify(platformName)).toLowerCase();
    if (!/^[a-z0-9-]{2,40}$/.test(slug)) {
      throw new BadRequestException(
        'Slug invalide. Lettres minuscules, chiffres et tirets uniquement (2-40 caractères)',
      );
    }

    // 1) Vérifier disponibilité du slug
    const { data: existing } = await this.sb.client
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (existing) {
      throw new ConflictException(`Le slug "${slug}" est déjà utilisé`);
    }

    // 2) Créer le user Supabase (auth.users)
    const { data: created, error: userErr } = await this.sb.client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      // role: 'owner' is used by buildUser() in the frontend to unlock
      // ProtectedRoleRoute for /studio/* and tenant admin pages.
      user_metadata: { source: 'cimolace_signup', kind, role: 'owner' },
    });

    if (userErr || !created?.user) {
      this.logger.warn(`auth.admin.createUser failed: ${userErr?.message}`);
      if (userErr?.message?.toLowerCase().includes('already')) {
        throw new ConflictException('Un compte existe déjà avec cet email');
      }
      throw new InternalServerErrorException(
        `Création du compte échouée: ${userErr?.message ?? 'inconnue'}`,
      );
    }
    const userId = created.user.id;

    // Marque AI (optionnelle) appliquée dès la création : couleurs + vitrine.
    const hexOk = (v?: string) => !!v && /^#[0-9a-fA-F]{6}$/.test(v);
    const brandFields: Record<string, unknown> = {};
    if (input.brand && (hexOk(input.brand.primary) || input.brand.site)) {
      if (hexOk(input.brand.primary) || hexOk(input.brand.accent)) {
        brandFields.brand_colors = {
          ...(hexOk(input.brand.primary) ? { primary: input.brand.primary } : {}),
          ...(hexOk(input.brand.accent) ? { accent: input.brand.accent } : {}),
        };
      }
      if (input.brand.site && typeof input.brand.site === 'object') {
        brandFields.metadata = { site: input.brand.site };
      }
    }

    // 3) Créer le tenant
    const { data: tenant, error: tenantErr } = await this.sb.client
      .from('tenants')
      .insert({
        name: platformName,
        slug,
        owner_user_id: userId,
        infrastructure_type: kind,
        status: 'active',
        plan: DEFAULT_PLAN_BY_KIND[kind as Kind] ?? 'free',
        billing_status: 'free',
        locale,
        timezone,
        ...brandFields,
      })
      .select('id, slug, name, infrastructure_type')
      .single();

    if (tenantErr || !tenant) {
      this.logger.error(`Tenant insert failed: ${tenantErr?.message}`);
      // Rollback : supprimer le user créé
      await this.deleteUserSafely(userId);
      throw new InternalServerErrorException(
        `Création du tenant échouée: ${tenantErr?.message ?? 'inconnue'}`,
      );
    }

    // 4) Créer la membership owner
    const { error: memErr } = await this.sb.client.from('tenant_memberships').insert({
      tenant_id: tenant.id,
      user_id: userId,
      role: 'owner',
      status: 'active',
    });
    if (memErr) {
      this.logger.warn(`tenant_membership owner insert failed: ${memErr.message}`);
      // On n'annule pas tout pour ça — owner_user_id sur tenants suffit pour l'admin.
      // Mais on log pour qu'on sache.
    }

    // 5) (Best-effort) Init AI credits balance pour LIRI / IA-heavy tenants
    if (kind === 'liri' || kind === 'school' || kind === 'medos') {
      try {
        // RPC pas typée dans Database — cast volontaire
        await (this.sb.client as unknown as {
          rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown>;
        }).rpc('init_tenant_ai_balance', {
          p_tenant_id: tenant.id,
          p_plan: 'free',
        });
      } catch (e) {
        this.logger.warn(
          `init_tenant_ai_balance échoué (non bloquant): ${(e as Error).message}`,
        );
      }
    }

    // 6) (Best-effort) Provisionner l'espace patient brandé instantané sur Vercel :
    //    {slug}.patient.cimolace.space. Pour les tenants santé qui utilisent le
    //    portail patient. Non bloquant — un échec n'annule jamais le signup.
    if (kind === 'medos' || kind === 'wellness') {
      await this.provisionPatientSubdomain(tenant.slug);
    }

    this.logger.log(
      `✅ Tenant ${tenant.slug} (${kind}) créé pour ${email} (user ${userId})`,
    );

    // Frontend va rediriger ici
    const next_url = `/t/${tenant.slug}/admin/${this.firstAdminTabFor(kind as Kind)}`;

    return {
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        infrastructure_type: tenant.infrastructure_type ?? kind,
      },
      user: { id: userId, email },
      next_url,
    };
  }

  /**
   * AI Brand-in-a-box — génère une identité de marque complète à partir d'une
   * description en langage naturel. Retourne couleurs + nom + contenu de
   * vitrine (hero, CTA, services) prêt à écrire dans brand_colors + metadata.site.
   *
   * Génération pure (aucune écriture DB) — le wizard d'onboarding ou l'admin
   * applique ensuite. Public pour le pré-signup ; à protéger par rate-limit
   * avant lancement grand public.
   */
  async generateBrand(description: string): Promise<{
    name: string;
    primary: string;
    accent: string;
    site: {
      heroTitle: string;
      heroAccent: string;
      heroSubtitle: string;
      ctaPrimary: string;
      services: { title: string; desc: string }[];
    };
  }> {
    const desc = (description || '').trim();
    if (desc.length < 8) {
      throw new BadRequestException('Décris ton activité en quelques mots (8 caractères min).');
    }
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey === 'replace_me') {
      throw new InternalServerErrorException('GROQ_API_KEY non configurée.');
    }
    const system = [
      'Tu es directeur artistique de marque pour des praticiens santé & bien-être.',
      "À partir d'une description, tu produis une identité de marque cohérente, élégante et professionnelle, en FRANÇAIS.",
      'Réponds UNIQUEMENT en JSON valide avec EXACTEMENT ces clés :',
      '{ "name": string (nom de marque court, 1-3 mots),',
      '  "primary": string (couleur hex #RRGGBB, accessible, adaptée à l\'activité),',
      '  "accent": string (hex #RRGGBB complémentaire),',
      '  "heroTitle": string (accroche ligne 1, finit par une virgule),',
      '  "heroAccent": string (ligne 2, la partie mise en couleur, 2-5 mots),',
      '  "heroSubtitle": string (1-2 phrases chaleureuses et pro),',
      '  "ctaPrimary": string (bouton, 2-3 mots, action),',
      '  "services": [exactement 3 objets { "title": string court, "desc": string 1 phrase }] }',
      'Pas de texte hors JSON.',
    ].join('\n');
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: desc },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.warn(`Groq brand gen failed (${res.status}): ${body.slice(0, 200)}`);
      throw new InternalServerErrorException('Génération IA indisponible, réessaie.');
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
    } catch {
      throw new InternalServerErrorException('Réponse IA invalide, réessaie.');
    }
    const hex = (v: unknown, fallback: string) =>
      typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
    const str = (v: unknown, fallback = '') => (typeof v === 'string' && v.trim() ? v.trim() : fallback);
    const rawServices = Array.isArray(parsed.services) ? parsed.services : [];
    const services = rawServices.slice(0, 3).map((s) => {
      const o = (s ?? {}) as Record<string, unknown>;
      return { title: str(o.title, 'Service'), desc: str(o.desc, '') };
    });
    return {
      name: str(parsed.name, 'Mon espace').slice(0, 60),
      primary: hex(parsed.primary, '#0d9488'),
      accent: hex(parsed.accent, '#0f766e'),
      site: {
        heroTitle: str(parsed.heroTitle, 'Votre santé,'),
        heroAccent: str(parsed.heroAccent, 'accompagnée au quotidien'),
        heroSubtitle: str(parsed.heroSubtitle, ''),
        ctaPrimary: str(parsed.ctaPrimary, 'Prendre rendez-vous'),
        services: services.length ? services : [],
      },
    };
  }

  /** Slug auto à partir du nom de la plateforme */
  private slugify(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // remove accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40);
  }

  /** Pour LIRI on amène direct sur /lives, sinon /admin générique */
  private firstAdminTabFor(kind: Kind): string {
    if (kind === 'liri') return 'lives';
    if (kind === 'school') return 'courses';
    return '';
  }

  private async deleteUserSafely(userId: string) {
    try {
      await this.sb.client.auth.admin.deleteUser(userId);
    } catch (e) {
      this.logger.warn(`Rollback deleteUser failed: ${(e as Error).message}`);
    }
  }

  /**
   * Provisionne le sous-domaine patient brandé {slug}.patient.cimolace.space
   * sur le projet Vercel patient-portal (via l'API Vercel). Le DNS wildcard
   * *.patient.cimolace.space route déjà vers Vercel ; cet appel attache le
   * sous-domaine au projet → Vercel émet le certificat et le sert.
   *
   * Best-effort : si VERCEL_TOKEN est absent ou l'API échoue, on log et on
   * continue (le tenant reste accessible via ?tenant={slug} sur patient.cimolace.space).
   */
  private async provisionPatientSubdomain(slug: string): Promise<void> {
    const token = process.env.VERCEL_TOKEN;
    const baseDomain = process.env.PATIENT_PORTAL_DOMAIN || 'patient.cimolace.space';
    const domain = `${slug}.${baseDomain}`;
    if (!token) {
      this.logger.warn(
        `VERCEL_TOKEN absent — espace ${domain} non provisionné automatiquement ` +
          `(définir VERCEL_TOKEN dans l'env de l'API pour l'activer)`,
      );
      return;
    }
    const projectId =
      process.env.VERCEL_PATIENT_PROJECT_ID || 'prj_WHgrJwPlzWscwX1lMPKa7rjivajx';
    const teamId = process.env.VERCEL_TEAM_ID || 'team_88680YTZRMqaKYKSg6anHLBZ';
    try {
      const res = await fetch(
        `https://api.vercel.com/v10/projects/${projectId}/domains?teamId=${teamId}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: domain }),
        },
      );
      if (res.ok) {
        this.logger.log(`✅ Espace patient provisionné : https://${domain}`);
        return;
      }
      // 409 = domaine déjà attaché → idempotent, on considère OK
      if (res.status === 409) {
        this.logger.log(`Espace ${domain} déjà provisionné (ok)`);
        return;
      }
      const body = await res.text().catch(() => '');
      this.logger.warn(
        `Provision Vercel ${domain} échouée (${res.status}, non bloquant) : ${body.slice(0, 200)}`,
      );
    } catch (e) {
      this.logger.warn(
        `Provision Vercel ${domain} exception (non bloquant) : ${(e as Error).message}`,
      );
    }
  }
}
