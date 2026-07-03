import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { SupabaseService } from '../../supabase/supabase.service';
import type { TenantContext } from '../../tenant/tenant.types';
import {
  EMBED_SCOPES_BY_MODE,
  EmbedJwtPayload,
  EmbedMode,
  isValidEmbedMode,
} from './embed.types';

@Injectable()
export class EmbedService {
  private readonly logger = new Logger(EmbedService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Émet un JWT court-vivant pour le widget MEDOS embarqué dans un site externe.
   *
   * Flux :
   *   1. Le widget JS sur zahirwellness.com lit `data-tenant="zahirwellness"`
   *   2. Il appelle POST /v1/medos/embed/token avec son Origin
   *   3. Cimolace vérifie que cet Origin est whitelisté pour ce tenant
   *      via `tenant_domains.usage='embed_origin'`
   *   4. Cimolace signe un JWT court (15 min) avec scope = celui du mode demandé
   *   5. Le widget utilise ce JWT pour appeler /v1/medos/*
   *
   * Pas de clé secrète côté navigateur — l'origine HTTP est le facteur de confiance.
   * La validation Origin est faite côté serveur (impossible à spoofer depuis un
   * navigateur grâce au CORS preflight, à condition que le navigateur respecte CORS).
   */
  async issueEmbedToken(input: {
    tenantSlug: string;
    mode: string;
    origin: string | undefined;
  }): Promise<{
    token: string;
    expires_in: number;
    api_base: string;
    mode: EmbedMode;
    scope: string[];
    /**
     * Returned alongside the token so the widget can theme its Shadow DOM
     * in a single round-trip. Mirrors the columns of `tenants` that drive
     * white-label rendering. brand_colors keys are kept as-is (`primary`,
     * `secondary`, `accent`) for the widget JS to map to CSS variables.
     */
    branding: {
      name: string;
      logo_url: string | null;
      colors: Record<string, string>;
    };
  }> {
    const { tenantSlug, mode, origin } = input;

    if (!isValidEmbedMode(mode)) {
      throw new BadRequestException(`Mode d'embed invalide : ${mode}`);
    }
    if (!origin) {
      throw new ForbiddenException(
        'Header Origin manquant — embed-token refusé',
      );
    }

    const normalizedOrigin = origin.toLowerCase();
    const originHost = this.extractHost(normalizedOrigin);

    // 1. Résoudre le tenant — incluant les colonnes de branding pour que
    // la réponse embed-token puisse théme le widget en 1 round-trip.
    const { data: tenant, error: tErr } = await (this.supabase.client as any)
      .from('tenants')
      .select('id, slug, status, name, logo_url, brand_colors')
      .eq('slug', tenantSlug)
      .maybeSingle();

    if (tErr || !tenant) {
      throw new NotFoundException(`Tenant "${tenantSlug}" introuvable`);
    }
    if ((tenant as any).status !== 'active') {
      throw new ForbiddenException('Tenant inactif');
    }

    // 2. Vérifier que l'Origin est whitelisté pour ce tenant
    const { data: domains, error: dErr } = await (this.supabase.client as any)
      .from('tenant_domains')
      .select('domain, usage, status')
      .eq('tenant_id', (tenant as any).id)
      .eq('usage', 'embed_origin')
      .eq('status', 'active');

    if (dErr) {
      throw new InternalServerErrorException(
        `Lookup tenant_domains failed: ${dErr.message}`,
      );
    }

    const allowedDomains = ((domains ?? []) as Array<{ domain: string }>).map(
      (d) => d.domain.toLowerCase(),
    );

    if (!allowedDomains.includes(originHost)) {
      throw new ForbiddenException(
        `Origin "${origin}" non autorisé pour ce tenant`,
      );
    }

    // 3. Construire le payload
    const scope = EMBED_SCOPES_BY_MODE[mode as EmbedMode];

    // SÉCURITÉ (IDOR/PHI) : le flux Niveau 1 est ANONYME et validé par la seule
    // Origin HTTP (falsifiable hors navigateur). Il ne DOIT JAMAIS fixer `sub` à
    // un patient : accepter un `patient_user_id` du corps ouvrait le dossier
    // médical de n'importe quel patient du tenant. La résolution d'un patient
    // n'appartient qu'au Niveau 2 (server-token, clé API `mdk_`, résolu serveur).
    const payload: EmbedJwtPayload = {
      tenant_id: (tenant as any).id,
      mode: mode as EmbedMode,
      scope,
      origin: normalizedOrigin,
      iss: 'cimolace-medos-embed',
    };

    const secret = this.config.get<string>('MEDOS_EMBED_JWT_SECRET');
    if (!secret) {
      throw new InternalServerErrorException(
        'MEDOS_EMBED_JWT_SECRET non configuré',
      );
    }

    const expiresInSec = 60 * 15; // 15 min
    const token = await this.jwt.signAsync(payload, {
      secret,
      expiresIn: expiresInSec,
    });

    const apiBase =
      this.config.get<string>('MEDOS_API_BASE') ?? 'https://api.cimolace.space';

    const t = tenant as {
      name?: string;
      logo_url?: string | null;
      brand_colors?: Record<string, string> | null;
    };

    return {
      token,
      expires_in: expiresInSec,
      api_base: apiBase,
      mode: mode as EmbedMode,
      scope,
      branding: {
        name: t.name ?? tenantSlug,
        logo_url: t.logo_url ?? null,
        colors: t.brand_colors ?? {},
      },
    };
  }

  private extractHost(origin: string): string {
    try {
      const u = new URL(origin);
      return u.host;
    } catch {
      return origin;
    }
  }

  // ─── Niveau 2 SSO — server-to-server token ───────────────────────────────

  /**
   * Émet un JWT embed-token "identifié" pour un patient précis, appelé par
   * le BACKEND du site tenant (auth via clé API tenant).
   *
   * Différences avec `issueEmbedToken` (Niveau 1, anonyme) :
   *  - Aucune validation Origin (le call vient du backend, pas du navigateur)
   *  - Le payload contient `sub = patient_user_id` → le widget affiche
   *    directement les données du patient sans login
   *  - Crée le patient automatiquement s'il n'existe pas encore
   *
   * Sécurité :
   *  - Protégé par ApiKeyGuard : seul le détenteur de la clé tenant peut
   *    appeler (clé secrète, server-side only)
   *  - Le tenant est résolu depuis la clé API → impossible de générer un
   *    token pour un autre tenant
   */
  async issueServerToken(input: {
    tenant: TenantContext;
    apiKeyId: string;
    patient_email: string;
    patient_first_name?: string;
    patient_last_name?: string;
    external_user_id?: string;
    mode: string;
  }): Promise<{
    token: string;
    expires_in: number;
    api_base: string;
    mode: EmbedMode;
    scope: string[];
    patient_user_id: string;
    patient_record_id: string;
    created: boolean;
  }> {
    if (!isValidEmbedMode(input.mode)) {
      throw new BadRequestException(`Mode d'embed invalide : ${input.mode}`);
    }

    // 1. Trouver ou créer le user Supabase
    const userResult = await this.findOrCreateUser(
      input.patient_email,
      input.patient_first_name,
      input.patient_last_name,
    );
    const userId = userResult.userId;

    // 2. Garantir le membership 'patient' sur ce tenant
    await (this.supabase.client as any)
      .from('tenant_memberships')
      .upsert(
        {
          tenant_id: input.tenant.id,
          user_id: userId,
          role: 'patient',
          status: 'active',
        },
        { onConflict: 'tenant_id,user_id' },
      );

    // 3. Trouver ou créer le record med_patients
    const patientResult = await this.findOrCreatePatient(
      input.tenant.id,
      userId,
      input.patient_first_name ?? '',
      input.patient_last_name ?? '',
      input.external_user_id,
    );

    // 4. Signer le JWT
    const scope = EMBED_SCOPES_BY_MODE[input.mode as EmbedMode];
    const secret = this.config.get<string>('MEDOS_EMBED_JWT_SECRET');
    if (!secret) {
      throw new InternalServerErrorException(
        'MEDOS_EMBED_JWT_SECRET non configuré',
      );
    }

    const payload: EmbedJwtPayload = {
      tenant_id: input.tenant.id,
      mode: input.mode as EmbedMode,
      scope,
      origin: 'server-to-server',
      iss: 'cimolace-medos-embed',
      sub: userId,
    };

    const expiresInSec = 60 * 15;
    const token = await this.jwt.signAsync(payload, {
      secret,
      expiresIn: expiresInSec,
    });

    const apiBase =
      this.config.get<string>('MEDOS_API_BASE') ?? 'https://api.cimolace.space';

    return {
      token,
      expires_in: expiresInSec,
      api_base: apiBase,
      mode: input.mode as EmbedMode,
      scope,
      patient_user_id: userId,
      patient_record_id: patientResult.patientId,
      created: userResult.created || patientResult.created,
    };
  }

  private async findOrCreateUser(
    email: string,
    firstName?: string,
    lastName?: string,
  ): Promise<{ userId: string; created: boolean }> {
    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const serviceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      throw new InternalServerErrorException(
        'Supabase non configuré pour la création de patients SSO',
      );
    }

    // 1. Chercher user existant via admin API (filtre par email)
    const listRes = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      },
    );
    if (listRes.ok) {
      const data = await listRes.json();
      const existing = (data?.users || []).find(
        (u: any) => u.email?.toLowerCase() === email.toLowerCase(),
      );
      if (existing) {
        return { userId: existing.id, created: false };
      }
    }

    // 2. Créer le user
    const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        email_confirm: true,
        user_metadata: {
          first_name: firstName ?? null,
          last_name: lastName ?? null,
          created_via: 'medos-server-token',
        },
      }),
    });
    if (!createRes.ok) {
      const body = await createRes.text();
      this.logger.error(`createUser failed: ${createRes.status} ${body}`);
      throw new InternalServerErrorException(
        `Création du user impossible : ${createRes.status}`,
      );
    }
    const created = await createRes.json();
    return { userId: created.id, created: true };
  }

  private async findOrCreatePatient(
    tenantId: string,
    userId: string,
    firstName: string,
    lastName: string,
    externalUserId?: string,
  ): Promise<{ patientId: string; created: boolean }> {
    // 1. Chercher record existant
    const { data: existing } = await this.supabase.client
      .from('med_patients')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('patient_user_id', userId)
      .maybeSingle();
    if (existing) {
      return { patientId: (existing as any).id, created: false };
    }

    // 2. Créer le record
    const { data: created, error } = await (this.supabase.client as any)
      .from('med_patients')
      .insert({
        tenant_id: tenantId,
        patient_user_id: userId,
        first_name: firstName || 'Patient',
        last_name: lastName || externalUserId || '',
        consent_given: false, // doit être donné explicitement via consent-form
        status: 'active',
      })
      .select('id')
      .single();
    if (error || !created) {
      throw new InternalServerErrorException(
        `Création du dossier patient impossible : ${error?.message}`,
      );
    }
    return { patientId: (created as any).id, created: true };
  }

  /**
   * Niveau 2 — SSO praticien pour embarquer le DASHBOARD admin MEDOS dans le
   * site d'un tenant (iframe). Appelé server-to-server par le backend du
   * tenant (clé API), qui sait quel praticien est connecté chez lui.
   *
   * Frappe une vraie session Supabase pour ce praticien (sans mot de passe),
   * la stocke comme un code à usage unique (auth_handoff_codes, TTL 2 min),
   * et renvoie le code. Le site charge alors
   * `med.cimolace.space/handoff?code=…` dans l'iframe → med-app échange le
   * code (POST /auth/handoff/exchange) et fait setSession → dashboard, zéro
   * relogin. Le praticien ne quitte jamais le site du tenant.
   */
  async mintPractitionerHandoff(
    tenant: TenantContext,
    practitionerEmail: string,
  ): Promise<{ code: string; expires_in: number }> {
    const email = (practitionerEmail || '').trim().toLowerCase();
    if (!email) throw new BadRequestException('practitioner_email requis');
    const supaUrl = this.config.get<string>('SUPABASE_URL');
    const srk = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!supaUrl || !srk) {
      throw new InternalServerErrorException('Supabase admin non configuré');
    }
    const adminHeaders = {
      apikey: srk,
      Authorization: `Bearer ${srk}`,
      'Content-Type': 'application/json',
    };

    // 1. generate_link valide que l'utilisateur existe + donne son id + le hash.
    const genRes = await fetch(`${supaUrl}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ type: 'magiclink', email }),
    });
    if (!genRes.ok) throw new NotFoundException('Praticien introuvable');
    const gen = (await genRes.json()) as any;
    const props = gen.properties ?? gen;
    const userId: string | undefined = gen.user?.id ?? gen.id;
    const hashedToken: string | undefined = props?.hashed_token;
    if (!userId || !hashedToken) {
      throw new InternalServerErrorException('Émission de session impossible');
    }

    // 2. Ce praticien appartient-il bien À CE tenant, avec un rôle staff ?
    const { data: membership } = await (this.supabase.client as any)
      .from('tenant_memberships')
      .select('role')
      .eq('tenant_id', tenant.id)
      .eq('user_id', userId)
      .in('role', ['practitioner', 'owner', 'clinic_admin', 'admin'])
      .maybeSingle();
    if (!membership) {
      throw new ForbiddenException(
        "Ce praticien n'appartient pas à ce tenant",
      );
    }

    // 3. token_hash → vraie session (access + refresh).
    const vRes = await fetch(`${supaUrl}/auth/v1/verify`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ type: 'magiclink', token_hash: hashedToken }),
    });
    if (!vRes.ok) {
      throw new InternalServerErrorException('Validation de session échouée');
    }
    const sess = (await vRes.json()) as any;
    const accessToken: string | undefined = sess.access_token;
    const refreshToken: string | undefined = sess.refresh_token;
    if (!accessToken || !refreshToken) {
      throw new InternalServerErrorException('Session invalide');
    }

    // 4. Stocke un code à usage unique (échangé par med-app/handoff).
    const code = randomBytes(32).toString('hex');
    const ttl = 120;
    const codeHash = createHash('sha256').update(code).digest('hex');
    const { error } = await (this.supabase.client as any)
      .from('auth_handoff_codes')
      .insert({
        code_hash: codeHash,
        access_token: accessToken,
        refresh_token: refreshToken,
        user_id: userId,
        expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
      });
    if (error) {
      throw new InternalServerErrorException(
        'Stockage du handoff impossible : ' + error.message,
      );
    }
    return { code, expires_in: ttl };
  }
}
