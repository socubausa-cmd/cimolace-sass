import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
// IMPORTANT — P5 architectural decision:
// MEDOS routes ALL video sessions through Liri (LiveService), not LiveKit
// directly. This is the contract: one video authority for the whole
// platform, so MEDOS / Mbolo / ISNA share recording, replay, billing
// minutes, and any future provider swap. After P5.4, MEDOS no longer
// imports LiveKitService or LiveKitModule at all.
import { LiveService } from '../../live/live.service';
import { EmailEngineService } from '../../email-engine/email-engine.service';
import type { TenantContext } from '../../tenant/tenant.types';
import {
  CreateTeleconsultDto,
  EndTeleconsultDto,
} from './dto/teleconsult.dto';

@Injectable()
export class TeleconsultService implements OnModuleInit {
  private readonly logger = new Logger(TeleconsultService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly liri: LiveService,
    private readonly email: EmailEngineService,
  ) {}

  /**
   * Fermeture AUTOMATIQUE des téléconsults abandonnées. Fermer l'onglet ne
   * déclenche pas end() : la session restait « active » à vie, l'invité seul
   * dans la room, et le RDV « confirmed » (blocage de créneau). Un balayage
   * toutes les 2 min détecte les rooms SANS HÔTE : après 5 min d'absence
   * continue (tolère un refresh / une coupure réseau), la session est
   * terminée d'office (ended_reason='timeout' → RDV completed → les invités
   * voient « Consultation terminée ») et la room LiveKit est fermée.
   */
  onModuleInit(): void {
    if (process.env.TELECONSULT_SWEEP_DISABLED === 'true') return;
    const t = setInterval(() => {
      this.sweepAbandoned().catch((e) =>
        this.logger.warn(`sweep: ${(e as Error).message}`),
      );
    }, 120_000);
    (t as unknown as { unref?: () => void }).unref?.();
  }

  async sweepAbandoned(
    tenantId?: string,
    graceMinutes = 5,
  ): Promise<{ checked: number; marked: number; ended: number }> {
    let q = (this.supabase.client as any)
      .from('med_teleconsult_sessions')
      .select('id, tenant_id, practitioner_id, host_absent_since, status')
      .in('status', ['scheduled', 'active']);
    if (tenantId) q = q.eq('tenant_id', tenantId);
    const { data: sessions } = await q;
    if (!sessions?.length) return { checked: 0, marked: 0, ended: 0 };

    const ids = (sessions as any[]).map((s) => s.id);
    // Miroir live_sessions = le live a réellement démarré (créé au premier
    // token hôte). Une session jamais lancée (RDV futur) n'est PAS balayée.
    const { data: lives } = await (this.supabase.client as any)
      .from('live_sessions')
      .select('id, status, host_user_id, teacher_id')
      .in('id', ids);
    const liveById = new Map(((lives ?? []) as any[]).map((l) => [l.id, l]));
    const tenantIds = [...new Set((sessions as any[]).map((s) => s.tenant_id))];
    const { data: tenants } = await this.supabase.client
      .from('tenants')
      .select('id, slug')
      .in('id', tenantIds);
    const slugById = new Map(
      ((tenants ?? []) as any[]).map((t) => [t.id, t.slug]),
    );

    let checked = 0;
    let marked = 0;
    let ended = 0;
    for (const s of sessions as any[]) {
      const live = liveById.get(s.id);
      if (!live || live.status === 'ended') continue;
      const slug = slugById.get(s.tenant_id);
      if (!slug) continue;
      checked++;

      let present: string[] = [];
      try {
        present = await this.liri.listRoomParticipants(slug, s.id);
      } catch {
        present = [];
      }
      const hostIds = new Set(
        [s.practitioner_id, live.host_user_id, live.teacher_id].filter(Boolean),
      );
      const hostPresent = present.some((p) => hostIds.has(p));

      if (hostPresent) {
        // L'hôte est (re)là : on efface le chrono d'absence.
        if (s.host_absent_since) {
          await (this.supabase.client as any)
            .from('med_teleconsult_sessions')
            .update({ host_absent_since: null })
            .eq('id', s.id);
        }
        continue;
      }

      if (!s.host_absent_since) {
        // Première détection d'absence : on arme le chrono (tolérance refresh).
        await (this.supabase.client as any)
          .from('med_teleconsult_sessions')
          .update({ host_absent_since: new Date().toISOString() })
          .eq('id', s.id);
        marked++;
        continue;
      }

      const absentMs = Date.now() - new Date(s.host_absent_since).getTime();
      if (absentMs < graceMinutes * 60_000) continue;

      try {
        await this.end(
          { id: s.tenant_id, slug } as unknown as TenantContext,
          'practitioner',
          s.id,
          { ended_reason: 'timeout' } as EndTeleconsultDto,
        );
        await this.liri.closeRoom(slug, s.id).catch(() => {});
        ended++;
        this.logger.log(
          `sweep: session ${s.id} terminée d'office (hôte absent ~${Math.round(absentMs / 60_000)} min)`,
        );
      } catch (e) {
        this.logger.warn(`sweep end ${s.id}: ${(e as Error).message}`);
      }
    }
    return { checked, marked, ended };
  }

  /**
   * Crée une session de téléconsultation : record DB + room LiveKit. Si un
   * appointment_id est fourni, le RDV est passé en type 'teleconsult'.
   */
  async create(
    tenant: TenantContext,
    practitionerId: string,
    dto: CreateTeleconsultDto,
  ) {
    const { data: patient, error: patErr } = await this.supabase.client
      .from('med_patients')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('id', dto.patient_id)
      .single();
    if (patErr || !patient) throw new NotFoundException('Patient introuvable');

    // Pré-créer un ID pour pouvoir générer le room name. Liri.roomNameFor
    // est une fonction pure — pas besoin de provisionner la room LiveKit
    // à ce stade (Liri.issueTokenForSession s'en occupe au premier join).
    const tempSessionId = crypto.randomUUID();
    const roomName = this.liri.roomNameFor(tenant.slug, tempSessionId);

    const { data, error } = await (this.supabase.client as any)
      .from('med_teleconsult_sessions')
      .insert({
        id: tempSessionId,
        tenant_id: tenant.id,
        appointment_id: dto.appointment_id ?? null,
        patient_id: dto.patient_id,
        practitioner_id: practitionerId,
        livekit_room_name: roomName,
        status: 'scheduled',
        recording_consented: dto.recording_consented ?? false,
      })
      .select('*')
      .single();
    if (error || !data) {
      this.logger.error('createTeleconsult', error?.message);
      throw new InternalServerErrorException(
        'Création de la session impossible',
      );
    }

    // Lier le RDV à la session
    if (dto.appointment_id) {
      await (this.supabase.client as any)
        .from('med_appointments')
        .update({
          teleconsult_session_id: (data as any).id,
          appointment_type: 'teleconsult',
        })
        .eq('tenant_id', tenant.id)
        .eq('id', dto.appointment_id);
    }

    return data;
  }

  /**
   * Issue a video session token. ROUTED THROUGH LIRI — MEDOS no longer
   * touches LiveKit directly. The medical access control (patient owns
   * the session, doctor belongs to the tenant) stays here; the actual
   * token issuance is delegated to Liri so recording / replay / billing
   * minutes can be unified across MEDOS / Mbolo / ISNA.
   */
  async issueToken(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    sessionId: string,
    displayName?: string,
  ): Promise<{ room: string; token: string; url: string; ttl: string }> {
    const { data: session, error } = await this.supabase.client
      .from('med_teleconsult_sessions')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('id', sessionId)
      .single();
    if (error || !session) throw new NotFoundException('Session introuvable');

    // Medical access control (kept in MEDOS — Liri doesn't need to know
    // about patient_user_id ↔ session.patient_id rules).
    if (actorRole === 'patient') {
      const { data: pat } = await this.supabase.client
        .from('med_patients')
        .select('patient_user_id')
        .eq('id', (session as any).patient_id)
        .single();
      if ((pat as any)?.patient_user_id !== actorId) {
        throw new ForbiddenException('Accès refusé à cette session');
      }
    }

    const isHost =
      actorRole === 'practitioner' ||
      actorRole === 'owner' ||
      actorRole === 'clinic_admin';

    // Bridge → full immersive Liri room. When the practitioner (host) starts
    // the call, mirror this teleconsult into a `live_sessions` row whose id
    // EQUALS the teleconsult session id. Because the LiveKit room name is
    // derived from that id (scopedRoomName(slug, id)), the immersive
    // LiveHostPage (which the practitioner opens at /studio/live-arena/:id)
    // and the patient (whose token is derived from the same id) land in the
    // SAME room — with zero change to the shared live-class token path.
    if (isHost) {
      await this.ensureImmersiveLiveSession(
        tenant,
        session as any,
        actorId,
      );
    }

    // Nom affiché sur la tuile vidéo : JAMAIS l'email brut du soignant/patient
    // (peu professionnel + fuite d'identifiant). On résout un VRAI nom depuis le
    // compte auth (full_name), repli sur le nom du cabinet (hôte) puis un libellé
    // neutre. Le contrôleur passe l'email comme simple indice → on l'écarte s'il
    // ressemble à une adresse.
    let liveKitName = String(displayName || '').trim();
    if (!liveKitName || liveKitName.includes('@')) {
      try {
        const { data: u } = await (this.supabase.client as any).auth.admin.getUserById(actorId);
        const meta = u?.user?.user_metadata || {};
        const resolved = String(meta.full_name || meta.name || '').trim();
        if (resolved && !resolved.includes('@')) liveKitName = resolved;
      } catch {
        /* best-effort : on garde le repli ci-dessous */
      }
    }
    if (!liveKitName || liveKitName.includes('@')) {
      liveKitName = isHost ? tenant.name || 'Praticien' : 'Patient';
    }

    // Delegate to Liri. The session.id is a stable, unique external_ref
    // so re-joins reuse the same LiveKit room. The metadata blob lets the
    // billing UI link back to the medical appointment without re-querying
    // the MEDOS-owned table.
    const result = await this.liri.issueTokenForSession({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      externalRef: sessionId,
      purpose: 'medical_teleconsult',
      userId: actorId,
      displayName: liveKitName,
      role: isHost ? 'host' : 'guest',
      // A teleconsultation is a two-way call: the PATIENT (guest) must be
      // able to publish their camera + mic. Without this they'd get a
      // subscribe-only token and stay invisible to the practitioner.
      guestCanPublish: true,
      metadata: {
        appointment_id: (session as any).appointment_id ?? null,
        patient_id: (session as any).patient_id ?? null,
      },
    });

    return {
      room: result.room,
      token: result.token,
      url: result.url,
      ttl: result.ttl,
    };
  }

  /**
   * Contexte clinique d'une session de téléconsultation, pour le COCKPIT
   * partagé (jumeau 3D / SOAP / graphiques) — côté studio (praticien) ET
   * côté patient.
   *
   * Ne renvoie QUE le strict nécessaire pour amorcer le chargement du
   * dossier : l'id du patient + son nom d'affichage + le rôle de l'appelant.
   * AUCUNE donnée clinique ici — le cockpit charge ensuite le jumeau / la
   * note via leurs endpoints dédiés (déjà gardés indépendamment).
   *
   * Contrôle d'accès STRICT (leçon C1 — la service-role contourne la RLS,
   * l'isolation est donc 100 % applicative) :
   *   - patient : doit être LE patient de cette session (patient_user_id) ;
   *   - staff   : practitioner / owner / clinic_admin du tenant (le select
   *               est déjà tenant-scopé) ;
   *   - tout autre cas → 403.
   */
  async getClinicalContext(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    sessionId: string,
  ): Promise<{
    session_id: string;
    patient_id: string;
    patient_name: string;
    sex: 'female' | 'male';
    practitioner_id: string;
    appointment_id: string | null;
    role: 'host' | 'patient';
    scheduled_at: string | null;
    agenda_reason: string | null;
    agenda_notes: string | null;
    host_present: boolean;
  }> {
    const { data: session, error } = await this.supabase.client
      .from('med_teleconsult_sessions')
      .select('id, patient_id, practitioner_id, appointment_id, practitioner_joined_at')
      .eq('tenant_id', tenant.id)
      .eq('id', sessionId)
      .single();
    if (error || !session) throw new NotFoundException('Session introuvable');

    const isHost =
      actorRole === 'practitioner' ||
      actorRole === 'owner' ||
      actorRole === 'clinic_admin';

    if (actorRole === 'patient') {
      // Le patient ne voit le contexte QUE de sa propre session.
      const { data: pat } = await this.supabase.client
        .from('med_patients')
        .select('patient_user_id')
        .eq('id', (session as any).patient_id)
        .single();
      if ((pat as any)?.patient_user_id !== actorId) {
        throw new ForbiddenException('Accès refusé à cette session');
      }
    } else if (!isHost) {
      // Ni patient propriétaire, ni staff soignant → interdit.
      throw new ForbiddenException('Accès refusé à cette session');
    }

    const { data: patient } = await this.supabase.client
      .from('med_patients')
      .select('first_name, last_name, gender')
      .eq('tenant_id', tenant.id)
      .eq('id', (session as any).patient_id)
      .single();

    const fullName = patient
      ? `${(patient as any).first_name ?? ''} ${(patient as any).last_name ?? ''}`.trim()
      : '';
    // Corps 3D : 'male' uniquement si explicitement masculin, sinon 'female'
    // (modèle par défaut du jumeau). Aucune autre valeur de gender n'est
    // exposée — seul le choix de mesh anatomique en dépend.
    const sex: 'female' | 'male' =
      String((patient as any)?.gender ?? '').toLowerCase().startsWith('m')
        ? 'male'
        : 'female';

    // Agenda + heure du RDV (pour la salle d'attente patient) : motif + notes +
    // créneau, depuis le rendez-vous lié. host_present = le praticien a démarré.
    let scheduledAt: string | null = null;
    let agendaReason: string | null = null;
    let agendaNotes: string | null = null;
    const apptId = (session as any).appointment_id;
    if (apptId) {
      const { data: appt } = await this.supabase.client
        .from('med_appointments')
        .select('scheduled_at, reason, notes')
        .eq('tenant_id', tenant.id)
        .eq('id', apptId)
        .single();
      scheduledAt = (appt as any)?.scheduled_at ?? null;
      agendaReason = (appt as any)?.reason ?? null;
      agendaNotes = (appt as any)?.notes ?? null;
    }

    return {
      session_id: (session as any).id,
      patient_id: (session as any).patient_id,
      patient_name: fullName || 'Patient',
      sex,
      practitioner_id: (session as any).practitioner_id,
      appointment_id: (session as any).appointment_id ?? null,
      role: isHost ? 'host' : 'patient',
      scheduled_at: scheduledAt,
      agenda_reason: agendaReason,
      agenda_notes: agendaNotes,
      host_present: !!(session as any).practitioner_joined_at,
    };
  }

  /**
   * Mirror a teleconsult session into a `live_sessions` row so the FULL
   * immersive Liri room (LiveHostPage — video grid + SmartBoard for the
   * practitioner to present images / sketch) can mount on it. Idempotent:
   * the row id == the teleconsult session id, so re-calls are no-ops.
   *
   * Additive by design — `kind='teleconsult'` keeps these rows out of the
   * live-class listings, and nothing in the class path is touched.
   */
  private async ensureImmersiveLiveSession(
    tenant: TenantContext,
    session: {
      id: string;
      patient_id: string;
      livekit_room_name: string;
    },
    hostUserId: string,
  ): Promise<void> {
    try {
      const { data: existing } = await this.supabase.client
        .from('live_sessions')
        .select('id')
        .eq('id', session.id)
        .maybeSingle();
      if (existing) return;

      // Nice human title from the patient name (best-effort).
      let title = 'Téléconsultation';
      const { data: pat } = await this.supabase.client
        .from('med_patients')
        .select('first_name, last_name')
        .eq('id', session.patient_id)
        .maybeSingle();
      const name = `${(pat as any)?.first_name ?? ''} ${(pat as any)?.last_name ?? ''}`.trim();
      if (name) title = `Téléconsultation — ${name}`;

      const { error } = await (this.supabase.client as any)
        .from('live_sessions')
        .insert({
          id: session.id,
          tenant_id: tenant.id,
          host_user_id: hostUserId,
          title,
          scheduled_at: new Date().toISOString(),
          status: 'scheduled',
          kind: 'teleconsult',
          livekit_room_name: session.livekit_room_name,
        });
      if (error && !String(error.message).includes('duplicate')) {
        this.logger.warn(
          'ensureImmersiveLiveSession insert failed (non-blocking): ' +
            error.message,
        );
      }
    } catch (err) {
      this.logger.warn(
        'ensureImmersiveLiveSession failed (non-blocking): ' +
          (err as Error).message,
      );
    }
  }

  async markJoined(
    tenant: TenantContext,
    actorRole: TenantContext['userRole'],
    sessionId: string,
  ) {
    const field =
      actorRole === 'patient'
        ? 'patient_joined_at'
        : 'practitioner_joined_at';
    const { data, error } = await (this.supabase.client as any)
      .from('med_teleconsult_sessions')
      .update({ [field]: new Date().toISOString(), status: 'active' })
      .eq('tenant_id', tenant.id)
      .eq('id', sessionId)
      // Ne RESSUSCITE PAS une session terminée : un POST :id/join tardif sur une
      // session 'ended' ne doit pas la repasser 'active' (room fermée + sweep qui boucle).
      .in('status', ['scheduled', 'active'])
      .select('*')
      .single();
    if (error || !data) throw new NotFoundException('Session introuvable ou déjà terminée');
    return data;
  }

  // ── Inviter un PROCHE (+ consentement RGPD du patient) ────────────────────
  // Un proche n'a pas de compte tenant : il rejoint via un lien token-gaté.
  // Garde fail-closed : aucun token vidéo n'est délivré tant que le PATIENT
  // n'a pas explicitement consenti (trace consent_by / consent_at).

  /** Charge la session (tenant-scopée) ou 404. */
  private async loadSession(tenantId: string, sessionId: string): Promise<any> {
    const { data, error } = await this.supabase.client
      .from('med_teleconsult_sessions')
      .select('id, patient_id, practitioner_id')
      .eq('tenant_id', tenantId)
      .eq('id', sessionId)
      .single();
    if (error || !data) throw new NotFoundException('Session introuvable');
    return data;
  }

  /** Vérifie que l'appelant est BIEN le patient propriétaire de la session. */
  private async assertPatientOwnsSession(
    session: any,
    actorId: string,
  ): Promise<void> {
    const { data: pat } = await this.supabase.client
      .from('med_patients')
      .select('patient_user_id')
      .eq('id', session.patient_id)
      .single();
    if ((pat as any)?.patient_user_id !== actorId) {
      throw new ForbiddenException('Accès refusé à cette session');
    }
  }

  /**
   * Host : crée une invitation. DEUX types :
   *  - 'member' (invited_user_id fourni) : un COMPTE du tenant (soignant) → admis
   *    d'office (status 'consented' dès la création : secret médical, pas de
   *    consentement patient requis pour un professionnel du cabinet). On récupère
   *    son nom + email depuis son compte auth si non fournis.
   *  - 'proche' (défaut) : un TIERS → status 'consent_requested' (RGPD : le token
   *    vidéo reste refusé tant que le patient n'a pas autorisé — fail-closed).
   * Si un email est connu, on lui envoie le LIEN d'invitation (best-effort ;
   * `email_status` trace sent/failed/disabled/skipped pour l'UI).
   */
  async createInvite(
    tenant: TenantContext,
    hostId: string,
    sessionId: string,
    dto: {
      display_name?: string;
      relationship?: string;
      email?: string;
      invited_user_id?: string;
      kind?: 'proche' | 'member';
    },
  ): Promise<any> {
    await this.loadSession(tenant.id, sessionId);

    const isMember = dto.kind === 'member' || !!dto.invited_user_id;
    let displayName = (dto.display_name || '').trim();
    let email = (dto.email || '').trim().toLowerCase();

    // Membre : compléter nom + email depuis le compte auth si absents.
    if (isMember && dto.invited_user_id) {
      try {
        const { data: u } = await (this.supabase.client as any).auth.admin.getUserById(dto.invited_user_id);
        const meta = u?.user?.user_metadata || {};
        if (!displayName) displayName = String(meta.full_name || meta.name || u?.user?.email || 'Membre');
        if (!email) email = String(u?.user?.email || '').toLowerCase();
      } catch {
        /* best-effort : on garde ce qui a été fourni */
      }
    }
    if (!displayName) displayName = isMember ? 'Membre' : 'Proche';

    const { data, error } = await (this.supabase.client as any)
      .from('med_teleconsult_invites')
      .insert({
        tenant_id: tenant.id,
        session_id: sessionId,
        display_name: displayName,
        relationship: (dto.relationship || '').trim() || null,
        invited_email: email || null,
        invited_user_id: isMember ? dto.invited_user_id || null : null,
        kind: isMember ? 'member' : 'proche',
        status: isMember ? 'consented' : 'consent_requested',
        consent_at: isMember ? new Date().toISOString() : null,
        created_by: hostId,
      })
      .select('*')
      .single();
    if (error || !data) {
      this.logger.error('createInvite', error?.message);
      throw new InternalServerErrorException("Création de l'invitation impossible");
    }

    // Envoi email du lien (best-effort) + trace du statut.
    const emailStatus = await this.sendInviteEmail(tenant.id, data);
    try {
      await (this.supabase.client as any)
        .from('med_teleconsult_invites')
        .update({ email_status: emailStatus })
        .eq('id', data.id);
    } catch { /* trace best-effort */ }
    return { ...data, email_status: emailStatus };
  }

  /**
   * Construit le lien d'invitation token-gaté et envoie l'email au concerné via
   * EmailEngine (depuis le domaine du tenant). Best-effort : renvoie le statut
   * ('sent' | 'failed' | 'disabled' | 'skipped' | 'error') sans jamais jeter.
   */
  private async sendInviteEmail(tenantId: string, invite: any): Promise<string> {
    const to = String(invite.invited_email || '').trim();
    if (!to) return 'skipped';
    const { data: t } = await this.supabase.client
      .from('tenants')
      .select('slug, name')
      .eq('id', tenantId)
      .maybeSingle();
    const slug = (t as any)?.slug || '';
    const clinic = (t as any)?.name || 'votre praticien';
    const base = process.env.APP_URL || 'https://app.cimolace.space';
    const link = `${base}/teleconsult/${invite.session_id}/proche/${invite.id}${slug ? `?tenant=${encodeURIComponent(slug)}` : ''}`;

    // « But de la réunion » AUTOMATIQUE : motif du RDV lié (appointments.reason).
    // Best-effort — s'il n'y a pas de RDV/motif, le message reste clair sans lui.
    let motif = '';
    try {
      const { data: sess } = await this.supabase.client
        .from('med_teleconsult_sessions')
        .select('appointment_id')
        .eq('id', invite.session_id)
        .maybeSingle();
      const apptId = (sess as any)?.appointment_id;
      if (apptId) {
        const { data: appt } = await this.supabase.client
          .from('appointments')
          .select('reason')
          .eq('id', apptId)
          .maybeSingle();
        motif = String((appt as any)?.reason || '').trim();
      }
    } catch {
      /* best-effort : motif optionnel */
    }

    // Message CLAIR qui commence par le NOM de l'invité + le BUT de la réunion.
    const name = String(invite.display_name || '').trim() || 'Bonjour';
    const object = motif
      ? `une téléconsultation médicale avec ${clinic} — motif : ${motif}`
      : `une téléconsultation médicale avec ${clinic}`;
    const access =
      invite.kind === 'member'
        ? 'Cliquez sur le bouton pour entrer dans la salle sécurisée.'
        : "L'accès s'ouvrira dès que le patient aura autorisé votre participation.";
    const html = this.email.brandedHtml({
      title: 'Invitation à une téléconsultation',
      body: `Bonjour ${name}, vous êtes invité·e à ${object}. ${access}`,
      ctaLabel: 'Rejoindre la consultation',
      ctaUrl: link,
    });
    try {
      const subject = `${name}, invitation à une téléconsultation — ${clinic}`;
      const r = await this.email.sendRaw(tenantId, to, subject, html);
      return r.status;
    } catch {
      return 'error';
    }
  }

  /** Host OU patient-propriétaire : liste les invitations actives de la session. */
  async listInvites(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    sessionId: string,
  ): Promise<any[]> {
    const session = await this.loadSession(tenant.id, sessionId);
    if (actorRole === 'patient') await this.assertPatientOwnsSession(session, actorId);
    const { data, error } = await this.supabase.client
      .from('med_teleconsult_invites')
      .select('id, display_name, relationship, status, consent_at, created_at')
      .eq('tenant_id', tenant.id)
      .eq('session_id', sessionId)
      .neq('status', 'revoked')
      .order('created_at', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /**
   * PATIENT uniquement : tranche le consentement (RGPD). Seul le patient
   * propriétaire de la session peut autoriser/refuser la participation d'un
   * proche au partage de ses données de santé. La décision est tracée.
   */
  async consentInvite(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    sessionId: string,
    inviteId: string,
    granted: boolean,
  ): Promise<any> {
    const session = await this.loadSession(tenant.id, sessionId);
    if (actorRole !== 'patient') {
      throw new ForbiddenException(
        'Seul le patient peut consentir à la participation d’un proche',
      );
    }
    await this.assertPatientOwnsSession(session, actorId);
    const { data, error } = await (this.supabase.client as any)
      .from('med_teleconsult_invites')
      .update({
        status: granted ? 'consented' : 'denied',
        consent_by: actorId,
        consent_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenant.id)
      .eq('session_id', sessionId)
      .eq('id', inviteId)
      .select('id, status, consent_at')
      .single();
    if (error || !data) throw new NotFoundException('Invitation introuvable');
    return data;
  }

  /**
   * HOST (praticien / owner / clinic_admin) : admet un proche EN L'ABSENCE du
   * patient. Le consentement RGPD reste porté par le patient quand il est
   * présent (`consentInvite`), MAIS le praticien — maître de séance et auteur
   * de l'invitation — doit pouvoir laisser entrer un proche quand le patient
   * n'est pas connecté (sinon le proche reste bloqué « en attente » à vie). On
   * trace qui a admis (`consent_by = actorId` du praticien).
   */
  async admitInvite(
    tenant: TenantContext,
    actorId: string,
    sessionId: string,
    inviteId: string,
  ): Promise<any> {
    await this.loadSession(tenant.id, sessionId); // tenant-scope + existence
    const { data, error } = await (this.supabase.client as any)
      .from('med_teleconsult_invites')
      .update({
        status: 'consented',
        consent_by: actorId,
        consent_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenant.id)
      .eq('session_id', sessionId)
      .eq('id', inviteId)
      // FAIL-CLOSED RGPD : n'admet JAMAIS une invitation REFUSÉE (denied) ou
      // RÉVOQUÉE (revoked) — le praticien ne peut pas passer outre un refus patient.
      .in('status', ['consent_requested', 'consented', 'admitted'])
      .select('id, status, consent_at')
      .single();
    if (error || !data) throw new NotFoundException('Invitation introuvable ou non admissible (refusée/révoquée)');
    return data;
  }

  /** Host OU patient-propriétaire : révoque une invitation (proche exclu). */
  async revokeInvite(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    sessionId: string,
    inviteId: string,
  ): Promise<any> {
    const session = await this.loadSession(tenant.id, sessionId);
    if (actorRole === 'patient') await this.assertPatientOwnsSession(session, actorId);
    const { data, error } = await (this.supabase.client as any)
      .from('med_teleconsult_invites')
      .update({ status: 'revoked' })
      .eq('tenant_id', tenant.id)
      .eq('session_id', sessionId)
      .eq('id', inviteId)
      .select('id, status')
      .single();
    if (error || !data) throw new NotFoundException('Invitation introuvable');
    return data;
  }

  /**
   * PUBLIC (token-gaté) : statut d'une invitation, pour la page du proche.
   * Renvoie le STRICT minimum (aucune donnée de santé) : où en est le
   * consentement + le nom du proche + le nom de la clinique.
   */
  async getInvitePublicStatus(inviteId: string): Promise<{
    status: string;
    display_name: string;
    session_id: string;
    clinic_name: string;
    session_status: string | null;
  }> {
    const { data: invite } = await (this.supabase.client as any)
      .from('med_teleconsult_invites')
      .select('id, session_id, tenant_id, display_name, status')
      .eq('id', inviteId)
      .maybeSingle();
    if (!invite) throw new NotFoundException('Invitation introuvable');
    const { data: tenant } = await this.supabase.client
      .from('tenants')
      .select('name')
      .eq('id', (invite as any).tenant_id)
      .maybeSingle();
    // Statut de la SESSION (pas seulement de l'invite) : sans ça, un proche
    // resté « en attente d'autorisation » poll indéfiniment même après que le
    // praticien a raccroché. La page proche affiche « Consultation terminée »
    // dès que status = 'ended' | 'cancelled'.
    const { data: sess } = await this.supabase.client
      .from('med_teleconsult_sessions')
      .select('status')
      .eq('id', (invite as any).session_id)
      .maybeSingle();
    return {
      status: (invite as any).status,
      display_name: (invite as any).display_name,
      session_id: (invite as any).session_id,
      clinic_name: (tenant as any)?.name || 'Consultation',
      session_status: (sess as any)?.status ?? null,
    };
  }

  /**
   * PUBLIC (auto-inscription au « LIEN DE GROUPE » d'une séance) : une personne
   * qui ouvre le lien de groupe saisit son nom + email → on crée SA PROPRE
   * invitation (inviteId unique → identité LiveKit unique → zéro collision/kick,
   * contrairement à un lien unique partagé à plusieurs). Elle atterrit ensuite
   * dans la salle d'attente `/proche/<inviteId>` où l'hôte l'admet nominativement.
   * Fail-closed : refuse si la séance est terminée. Le lien de groupe = l'id de
   * séance (UUID non devinable) et meurt donc avec la séance.
   */
  async selfRegisterInvite(
    sessionId: string,
    dto: { name?: string; email?: string; relationship?: string },
  ): Promise<{ invite_id: string }> {
    const name = String(dto?.name || '').trim();
    if (!name) throw new BadRequestException('Votre nom est requis.');

    const { data: sess } = await (this.supabase.client as any)
      .from('med_teleconsult_sessions')
      .select('id, tenant_id, status, practitioner_id')
      .eq('id', sessionId)
      .maybeSingle();
    if (!sess) throw new NotFoundException('Séance introuvable.');
    if ((sess as any).status === 'ended') {
      throw new ForbiddenException('Cette consultation est terminée.');
    }

    const email = String(dto?.email || '').trim().toLowerCase();
    const { data, error } = await (this.supabase.client as any)
      .from('med_teleconsult_invites')
      .insert({
        tenant_id: (sess as any).tenant_id,
        session_id: sessionId,
        display_name: name.slice(0, 80),
        relationship: String(dto?.relationship || '').trim().slice(0, 60) || null,
        invited_email: email || null,
        kind: 'proche',
        status: 'consent_requested',
        // created_by est NOT NULL : on rattache l'invitation au praticien-hôte.
        created_by: (sess as any).practitioner_id,
      })
      .select('id')
      .single();
    if (error || !data) {
      this.logger.error('selfRegisterInvite', error?.message);
      throw new InternalServerErrorException('Inscription impossible pour le moment.');
    }
    return { invite_id: (data as any).id };
  }

  /**
   * PUBLIC (token-gaté) : délivre le token vidéo INVITÉ au proche. FAIL-CLOSED —
   * uniquement si le patient a consenti (status 'consented' ou déjà 'admitted'
   * pour les reconnexions). Le proche rejoint la MÊME room que la session
   * (externalRef = session_id) en invité publiant (caméra + micro).
   */
  async issueInviteToken(inviteId: string): Promise<{
    url: string;
    token: string;
    display_name: string;
    session_id: string;
  }> {
    const { data: invite } = await (this.supabase.client as any)
      .from('med_teleconsult_invites')
      .select('id, session_id, tenant_id, display_name, status')
      .eq('id', inviteId)
      .maybeSingle();
    if (!invite) throw new NotFoundException('Invitation introuvable');
    const inv = invite as any;
    if (inv.status !== 'consented' && inv.status !== 'admitted') {
      throw new ForbiddenException(
        "En attente de l'autorisation du patient",
      );
    }

    // NE DÉLIVRE PAS de token vidéo si la consultation est TERMINÉE : sinon un
    // vieux lien (transféré par email/WhatsApp) reste rejoignable après la fin.
    const { data: sess } = await (this.supabase.client as any)
      .from('med_teleconsult_sessions')
      .select('status')
      .eq('id', inv.session_id)
      .maybeSingle();
    if (sess && (sess as any).status === 'ended') {
      throw new ForbiddenException('Cette consultation est terminée.');
    }

    const { data: tenant } = await this.supabase.client
      .from('tenants')
      .select('slug')
      .eq('id', inv.tenant_id)
      .single();
    if (!tenant) throw new NotFoundException('Tenant introuvable');

    // MONO-OCCUPATION : un lien invité = UN siège. L'identité LiveKit est
    // `proche_<inviteId>` ; si le même lien est réutilisé par une 2e personne,
    // LiveKit (une seule connexion par identité) ÉJECTE le 1er connecté. On
    // REFUSE donc une 2e émission de token tant qu'un participant avec cette
    // identité est présent dans la room → l'occupant reste, l'intrus est bloqué.
    // Best-effort : si la liste LiveKit échoue, on laisse passer (dispo > blocage).
    try {
      const present = await this.liri.listRoomParticipants(
        (tenant as any).slug,
        inv.session_id,
      );
      if (Array.isArray(present) && present.includes(`proche_${inv.id}`)) {
        throw new ForbiddenException(
          'Ce lien est déjà utilisé par une personne connectée. Un seul participant par lien — demandez votre propre lien d’invitation.',
        );
      }
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
      /* liste LiveKit indisponible → on n'empêche pas la connexion */
    }

    const result = await this.liri.issueTokenForSession({
      tenantId: inv.tenant_id,
      tenantSlug: (tenant as any).slug,
      externalRef: inv.session_id,
      purpose: 'medical_teleconsult',
      userId: `proche_${inv.id}`,
      displayName: inv.display_name,
      role: 'guest',
      guestCanPublish: true,
      metadata: { teleconsult_invite_id: inv.id },
    });

    if (inv.status !== 'admitted') {
      await (this.supabase.client as any)
        .from('med_teleconsult_invites')
        .update({ status: 'admitted', joined_at: new Date().toISOString() })
        .eq('id', inv.id);
    }

    return {
      url: result.url,
      token: result.token,
      display_name: inv.display_name,
      session_id: inv.session_id,
    };
  }

  /**
   * Convenience flow for the UI: from an appointment, get-or-create the
   * teleconsult session (doctor) or fetch the existing one (patient),
   * then issue a token. Lets the UI implement "Start / Join" as a single
   * click without juggling two endpoints.
   */
  async joinFromAppointment(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    appointmentId: string,
    displayName?: string,
  ): Promise<{ session_id: string; room: string; token: string; url: string; ttl: string }> {
    const { data: appt } = await this.supabase.client
      .from('med_appointments')
      .select('id, patient_id, practitioner_id, teleconsult_session_id, appointment_type')
      .eq('tenant_id', tenant.id)
      .eq('id', appointmentId)
      .single();
    if (!appt) throw new NotFoundException('RDV introuvable');
    const a = appt as any;

    // Verify the patient owns this appointment
    if (actorRole === 'patient') {
      const { data: pat } = await this.supabase.client
        .from('med_patients')
        .select('patient_user_id')
        .eq('id', a.patient_id)
        .single();
      if ((pat as any)?.patient_user_id !== actorId) {
        throw new ForbiddenException('Accès refusé à ce RDV');
      }
    }

    let sessionId: string | null = a.teleconsult_session_id;

    if (!sessionId) {
      if (actorRole === 'patient') {
        throw new NotFoundException(
          "Aucune session de téléconsultation n'est encore prête. Demandez à votre praticien de la démarrer.",
        );
      }
      const session = await this.create(tenant, a.practitioner_id, {
        patient_id: a.patient_id,
        appointment_id: a.id,
        recording_consented: false,
      });
      sessionId = (session as any).id as string;
    }

    const tokenResp = await this.issueToken(
      tenant,
      actorId,
      actorRole,
      sessionId,
      displayName,
    );
    return { session_id: sessionId, ...tokenResp };
  }

  async end(
    tenant: TenantContext,
    actorRole: TenantContext['userRole'],
    sessionId: string,
    dto: EndTeleconsultDto,
  ) {
    const { data: session, error: loadErr } = await this.supabase.client
      .from('med_teleconsult_sessions')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('id', sessionId)
      .single();
    if (loadErr || !session) throw new NotFoundException('Session introuvable');

    const sessionRow = session as any;
    // IDEMPOTENT : une session déjà terminée ne se re-termine pas (sinon un
    // second POST :id/end regonfle `duration_seconds` / réécrit `ended_reason`).
    if (sessionRow.status === 'ended') return sessionRow;
    const now = new Date().toISOString();

    // Calculer durée si on a un join_at
    const earliestJoin =
      sessionRow.practitioner_joined_at && sessionRow.patient_joined_at
        ? new Date(
            Math.min(
              new Date(sessionRow.practitioner_joined_at).getTime(),
              new Date(sessionRow.patient_joined_at).getTime(),
            ),
          )
        : sessionRow.practitioner_joined_at
          ? new Date(sessionRow.practitioner_joined_at)
          : sessionRow.patient_joined_at
            ? new Date(sessionRow.patient_joined_at)
            : null;

    const durationSec = earliestJoin
      ? Math.floor((Date.now() - earliestJoin.getTime()) / 1000)
      : null;

    const leftField =
      actorRole === 'patient'
        ? { patient_left_at: now }
        : { practitioner_left_at: now };

    const { data, error } = await (this.supabase.client as any)
      .from('med_teleconsult_sessions')
      .update({
        ...leftField,
        status: 'ended',
        ended_reason: dto.ended_reason ?? 'normal',
        connection_quality: dto.connection_quality ?? null,
        technical_issues: dto.technical_issues ?? null,
        quick_note: dto.quick_note ?? null,
        duration_seconds: durationSec,
      })
      .eq('tenant_id', tenant.id)
      .eq('id', sessionId)
      .select('*')
      .single();
    if (error || !data)
      throw new InternalServerErrorException('Fin de session impossible');

    // La salle LIRI miroir porte la salle d'attente et les clients invités.
    // La terminer ici déclenche leur expulsion et clôt les demandes pendantes.
    await this.supabase.client
      .from('live_sessions')
      .update({ status: 'ended', ended_at: now })
      .eq('id', sessionId);

    // FERMETURE de la room LiveKit : sinon les tokens patient/proche restent
    // valides ~2 h et la room ne s'éteint qu'à `emptyTimeout`. On la ferme ici
    // (comme le sweep) → expulsion serveur immédiate. Best-effort.
    if ((tenant as any).slug) {
      await this.liri.closeRoom((tenant as any).slug, sessionId).catch(() => {});
    }

    // Cohérence RDV ↔ session : une téléconsult terminée CLÔT son RDV. Sans ça
    // le RDV reste 'confirmed' et bloque à tort la création de nouveaux
    // créneaux qui le chevauchent (détection de conflit dans appointments →
    // 409). Best-effort, ne bloque pas la fin de séance.
    if (sessionRow.appointment_id) {
      await (this.supabase.client as any)
        .from('med_appointments')
        .update({ status: 'completed' })
        .eq('tenant_id', tenant.id)
        .eq('id', sessionRow.appointment_id)
        .in('status', ['requested', 'confirmed', 'rescheduled']);
    }

    // Tell Liri the session ended so its ledger row gets a duration. Failing
    // here would not invalidate the MEDOS-side end, so we swallow the error.
    try {
      await this.liri.endLiriSession(tenant.id, sessionId);
    } catch (err) {
      this.logger.warn(
        'liri.endLiriSession failed (non-blocking): ' +
          (err as Error).message,
      );
    }

    return data;
  }

  async list(tenant: TenantContext, filters: { patient_id?: string } = {}) {
    let q = this.supabase.client
      .from('med_teleconsult_sessions')
      .select('*')
      .eq('tenant_id', tenant.id);
    if (filters.patient_id) q = q.eq('patient_id', filters.patient_id);
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }
}
