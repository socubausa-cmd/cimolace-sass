import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { LiveKitService } from "../livekit/livekit.service";
import { LiriEntitlementsService } from "../billing/liri-entitlements.service";

@Injectable()
export class LiveService {
  constructor(
    private auth: AuthService,
    private liveKit: LiveKitService,
    private entitlements: LiriEntitlementsService,
  ) {}

  private get supabase() { return this.auth.getClient(); }

  async createSession(tenantId: string, data: any) {
    const { data: session } = await this.supabase
      .from("live_sessions")
      .insert({ tenant_id: tenantId, ...data, status: "scheduled" })
      .select()
      .single();
    return session;
  }

  async findAll(tenantId: string) {
    const { data } = await this.supabase
      .from("live_sessions")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("scheduled_at", { ascending: true });
    return data ?? [];
  }

  async findOne(tenantId: string, sessionId: string) {
    const { data, error } = await this.supabase
      .from("live_sessions")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", sessionId)
      .single();
    if (error || !data) throw new NotFoundException("Session introuvable");
    return data;
  }

  /**
   * Passe une session "en direct" : status = 'live' + started_at = now.
   * Idempotent (no-op si déjà live), refuse de relancer une session terminée.
   * Surface JWT (host mobile/web) — équivalent du startSession côté API publique
   * (liri-public), mais scopé par le tenant du JWT appelant.
   */
  async startSession(tenantId: string, sessionId: string) {
    const session = await this.findOne(tenantId, sessionId);
    if ((session as any).status === "live") return session;
    if ((session as any).status === "ended") {
      throw new BadRequestException("La session est déjà terminée");
    }
    // ── Enforcement palier (Couche A) : 1 seul live SIMULTANÉ en gratuit ──
    // Barrière non contournable : on refuse de passer un 2e live "en direct" tant
    // qu'un autre tourne. Le payant/essai n'est jamais limité (maxConcurrentLives=null).
    const { limits } = await this.entitlements.resolveLimits(tenantId);
    if (limits.maxConcurrentLives !== null) {
      const { count } = await this.supabase
        .from("live_sessions")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "live")
        .neq("id", sessionId);
      if ((count ?? 0) >= limits.maxConcurrentLives) {
        throw new ForbiddenException(
          `Forfait gratuit : ${limits.maxConcurrentLives} live à la fois. Terminez votre live en cours, ou passez à un forfait LIRI pour des lives simultanés.`,
        );
      }
    }
    const { data } = await this.supabase
      .from("live_sessions")
      .update({ status: "live", started_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("tenant_id", tenantId)
      .select("*")
      .single();
    return data;
  }

  /**
   * Termine une session : status = 'ended' + ended_at = now. Idempotent.
   */
  async endSession(tenantId: string, sessionId: string) {
    // Arrête un éventuel enregistrement en cours avant de clore la session.
    try {
      await this.stopRecording(tenantId, sessionId);
    } catch {
      /* pas d'enregistrement actif → on continue */
    }
    const { data } = await this.supabase
      .from("live_sessions")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("tenant_id", tenantId)
      .select("*")
      .single();
    if (!data) throw new NotFoundException("Session introuvable");
    return data;
  }

  /**
   * Démarre l'enregistrement (LiveKit Egress → MP4) de la room de la session,
   * enregistre la ligne live_recordings et active le replay. Si l'egress n'est
   * pas configuré (clés manquantes), renvoie egressId null sans casser le live.
   */
  async startRecording(tenantId: string, sessionId: string) {
    const session: any = await this.findOne(tenantId, sessionId);
    // Le slug DOIT être identique à celui de generateToken/ensureRoom — sinon l'egress
    // vise une room inexistante (`_<id>` au lieu de `isna_<id>`) → échec. Or
    // live_sessions.tenant_slug est souvent NULL → on lit le slug du TENANT.
    const { data: tnt } = await this.supabase
      .from("tenants")
      .select("slug")
      .eq("id", tenantId)
      .maybeSingle();
    const slug = (tnt as any)?.slug ?? session.tenant_slug ?? sessionId;
    const roomName = LiveKitService.scopedRoomName(slug, sessionId);
    const { egressId, filepath } = await this.liveKit.startRecording(roomName, sessionId, slug);
    const { data } = await this.supabase
      .from("live_recordings")
      .insert({
        live_session_id: sessionId,
        egress_id: egressId,
        status: egressId ? "recording" : "failed",
        started_at: new Date().toISOString(),
        tenant_slug: slug,
        storage_filepath: filepath,
      })
      .select("*")
      .single();
    if (egressId) {
      await this.supabase
        .from("live_sessions")
        .update({ replay_enabled: true })
        .eq("id", sessionId)
        .eq("tenant_id", tenantId);
    }
    return { recording: data, egressId, recording_active: Boolean(egressId) };
  }

  /**
   * Arrête l'enregistrement actif de la session (stop egress + clôture de la
   * ligne live_recordings). No-op si aucun enregistrement en cours.
   */
  async stopRecording(tenantId: string, sessionId: string) {
    await this.findOne(tenantId, sessionId); // autorise (scopé tenant)
    const { data: rec } = await this.supabase
      .from("live_recordings")
      .select("*")
      .eq("live_session_id", sessionId)
      .eq("status", "recording")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (rec?.egress_id) await this.liveKit.stopRecording(rec.egress_id);
    if (rec?.id) {
      await this.supabase
        .from("live_recordings")
        .update({ status: "stopped", completed_at: new Date().toISOString() })
        .eq("id", rec.id);
    }
    return { stopped: Boolean(rec), recordingId: rec?.id ?? null, recording_active: false };
  }

  /**
   * Mode de publication des replays du tenant (tenants.metadata.replay.publish_mode) :
   *   'auto'   → replay visible des élèves dès la fin de l'enregistrement ('published') ;
   *   'review' (défaut) → 'pending_review' tant que l'hôte n'a pas approuvé.
   */
  private async replayPublishStatus(
    tenantId: string,
  ): Promise<"published" | "pending_review"> {
    const { data } = await this.supabase
      .from("tenants")
      .select("metadata")
      .eq("id", tenantId)
      .maybeSingle();
    const mode = (data as any)?.metadata?.replay?.publish_mode;
    return mode === "auto" ? "published" : "pending_review";
  }

  /** Vrai si l'acteur est l'hôte/formateur de la session OU un encadrant du tenant. */
  private async isSessionEditor(
    tenantId: string,
    sessionId: string,
    actorId: string,
  ): Promise<boolean> {
    const { data: s } = await this.supabase
      .from("live_sessions")
      .select("host_user_id, teacher_id")
      .eq("id", sessionId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (s && (s.host_user_id === actorId || (s as any).teacher_id === actorId)) {
      return true;
    }
    const { data: m } = await this.supabase
      .from("tenant_memberships")
      .select("role")
      .eq("tenant_id", tenantId)
      .eq("user_id", actorId)
      .maybeSingle();
    return ["owner", "admin", "teacher"].includes(String((m as any)?.role || ""));
  }

  /**
   * PONT replay : relie l'enregistrement (live_recordings.output_url) à l'état lu par
   * l'élève (live_neuro_recall_state). Prend le dernier enregistrement complété de la
   * session et upsert l'état avec le bon workflow_status :
   *   - opts.force            → statut imposé (ex. 'published' quand l'hôte approuve) ;
   *   - sinon réglage tenant  → 'published' (auto) ou 'pending_review' (revue).
   * Appelé (1) par le webhook egress_ended (SANS actorId = système, fiable) ;
   *        (2) par l'hôte via POST /lives/:id/replay/publish (AVEC actorId → garde).
   * Idempotent (live_session_id UNIQUE).
   */
  async publishReplay(
    tenantId: string,
    sessionId: string,
    opts?: { force?: "published" | "pending_review"; actorId?: string },
  ) {
    if (
      opts?.actorId &&
      !(await this.isSessionEditor(tenantId, sessionId, opts.actorId))
    ) {
      throw new ForbiddenException("Réservé à l'hôte ou à un encadrant");
    }
    const { data: rec } = await this.supabase
      .from("live_recordings")
      .select("storage_filepath")
      .eq("live_session_id", sessionId)
      .eq("status", "completed")
      .not("storage_filepath", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!(rec as any)?.storage_filepath) {
      return { published: false, reason: "no_recording" as const };
    }
    // URL STABLE de lecture : l'endpoint GET /lives/:id/replay/file présigne R2 À
    // LA LECTURE (TTL court → PERMANENT, pas d'expiration figée dans le message) et
    // vérifie l'accès fail-closed. Le front fetche cette URL (Bearer) puis joue
    // <video> avec l'URL présignée fraîche renvoyée.
    const playbackUrl = `${process.env.PUBLIC_API_URL ?? "https://api.cimolace.space"}/lives/${sessionId}/replay/file`;
    const status = opts?.force ?? (await this.replayPublishStatus(tenantId));
    const { data } = await this.supabase
      .from("live_neuro_recall_state")
      .upsert(
        {
          live_session_id: sessionId,
          replay_public_url: playbackUrl,
          workflow_status: status,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "live_session_id" },
      )
      .select("*")
      .single();
    // Forum connecté : un replay PUBLIÉ converge dans le Sujet du live (même surface
    // que le chat consolidé + le récap du neurone, même accès fail-closed). En
    // 'pending_review', on ne poste PAS (l'élève ne doit pas le voir avant approbation).
    let forumPosted = false;
    if (status === "published") {
      forumPosted = await this.postReplayToForum(tenantId, sessionId, playbackUrl);
    }
    return {
      published: status === "published",
      workflow_status: status,
      forumPosted,
      state: data,
    };
  }

  /**
   * Accès LECTURE replay — réplique focalisée de hasLiveTopicAccess (module
   * messaging), gardée self-contained pour éviter un cycle de modules : encadrant
   * /hôte (isSessionEditor) OU participant effectif au live
   * (live_session_participants) OU inscrit au cours lié (student_progress).
   * Garde fail-closed de l'endpoint /replay/file.
   */
  private async canViewReplay(
    tenantId: string,
    sessionId: string,
    userId: string,
  ): Promise<boolean> {
    if (await this.isSessionEditor(tenantId, sessionId, userId)) return true;
    const { data: p } = await this.supabase
      .from("live_session_participants")
      .select("user_id")
      .eq("live_session_id", sessionId)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (p) return true;
    const { data: sess } = await this.supabase
      .from("live_sessions")
      .select("formation_id")
      .eq("id", sessionId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    const formationId = (sess as any)?.formation_id as string | undefined;
    if (formationId) {
      const { data: e } = await this.supabase
        .from("student_progress")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .eq("course_id", formationId)
        .limit(1)
        .maybeSingle();
      if (e) return true;
    }
    return false;
  }

  /**
   * Résout l'URL de LECTURE du replay (endpoint GET /lives/:id/replay/file) :
   * dérive le tenant de la session, vérifie l'accès fail-closed (canViewReplay),
   * prend le dernier enregistrement complété et PRÉSIGNE sa clé R2 à la lecture
   * (TTL court). Permanent : une URL fraîche est émise à chaque visionnage.
   */
  async resolveReplayPlaybackUrl(
    sessionId: string,
    userId: string,
  ): Promise<string> {
    const { data: sess } = await this.supabase
      .from("live_sessions")
      .select("tenant_id")
      .eq("id", sessionId)
      .maybeSingle();
    const tenantId = (sess as any)?.tenant_id as string | undefined;
    if (!tenantId) throw new NotFoundException("Session introuvable");
    if (!(await this.canViewReplay(tenantId, sessionId, userId))) {
      throw new ForbiddenException("Accès au replay refusé");
    }
    const { data: rec } = await this.supabase
      .from("live_recordings")
      .select("storage_filepath")
      .eq("live_session_id", sessionId)
      .eq("status", "completed")
      .not("storage_filepath", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const filepath = (rec as any)?.storage_filepath as string | undefined;
    if (!filepath) throw new NotFoundException("Aucun enregistrement disponible");
    const url = await this.liveKit.presignReplayGet(filepath, 3600);
    if (!url) throw new ServiceUnavailableException("Stockage replay indisponible");
    return url;
  }

  /** Dépublie le replay (revue hôte) : repasse en 'pending_review' (invisible élève). */
  async unpublishReplay(tenantId: string, sessionId: string, actorId?: string) {
    if (actorId && !(await this.isSessionEditor(tenantId, sessionId, actorId))) {
      throw new ForbiddenException("Réservé à l'hôte ou à un encadrant");
    }
    const { data } = await this.supabase
      .from("live_neuro_recall_state")
      .update({
        workflow_status: "pending_review",
        updated_at: new Date().toISOString(),
      })
      .eq("live_session_id", sessionId)
      .select("*")
      .maybeSingle();
    // Forum connecté : on retire aussi le message de replay du Sujet (invisible élève
    // tant que non republié).
    await this.removeReplayFromForum(tenantId, sessionId);
    return { unpublished: Boolean(data), state: data };
  }

  private static REPLAY_MARK = "📹 Replay du live";

  /**
   * Forum connecté : poste le replay dans le Sujet du live (kind='topic',
   * context_type='live'). Résout (ou crée) le Sujet puis insère UN message
   * « 📹 Replay du live » porteur de l'URL (anti-doublon). service_role — le contrôle
   * d'accès est porté par le Sujet lui-même (fail-closed à la lecture côté messaging).
   */
  private async postReplayToForum(
    tenantId: string,
    sessionId: string,
    replayUrl: string,
  ): Promise<boolean> {
    const { data: s } = await this.supabase
      .from("live_sessions")
      .select("host_user_id, title")
      .eq("id", sessionId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!s) return false;
    const hostId = (s as any).host_user_id as string;
    const title = ((s as any).title as string) || "Live";

    const topicId = await this.resolveLiveTopicId(tenantId, sessionId, hostId, title);
    if (!topicId) return false;

    const { data: dup } = await this.supabase
      .from("messages")
      .select("id")
      .eq("conversation_id", topicId)
      .ilike("content", `${LiveService.REPLAY_MARK}%`)
      .limit(1)
      .maybeSingle();
    if (dup) return true; // déjà présent

    const content = `${LiveService.REPLAY_MARK} — ${title}\n${replayUrl}`;
    const { error } = await this.supabase.from("messages").insert({
      tenant_id: tenantId,
      conversation_id: topicId,
      sender_id: hostId,
      recipient_id: null,
      content,
    });
    if (error) return false;
    await this.supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", topicId);
    return true;
  }

  /** Retire le message de replay du Sujet du live (sur dépublication). */
  private async removeReplayFromForum(
    tenantId: string,
    sessionId: string,
  ): Promise<void> {
    const topicId = await this.resolveLiveTopicId(tenantId, sessionId);
    if (!topicId) return;
    await this.supabase
      .from("messages")
      .delete()
      .eq("conversation_id", topicId)
      .ilike("content", `${LiveService.REPLAY_MARK}%`);
  }

  /**
   * Résout l'id du Sujet de forum du live. Si absent ET hostId fourni, le crée
   * (idempotent : index unique → 23505 → on relit). null si introuvable.
   */
  private async resolveLiveTopicId(
    tenantId: string,
    sessionId: string,
    hostId?: string,
    title?: string,
  ): Promise<string | null> {
    const found = await this.supabase
      .from("conversations")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("kind", "topic")
      .eq("context_type", "live")
      .eq("context_id", sessionId)
      .maybeSingle();
    if (found.data?.id) return found.data.id as string;
    if (!hostId) return null;
    const subject = `Sujet du live — ${title || "Live"}`;
    const ins = await this.supabase
      .from("conversations")
      .insert({
        tenant_id: tenantId,
        kind: "topic",
        type: "group",
        name: subject,
        subject,
        status: "open",
        visibility: "context",
        context_type: "live",
        context_id: sessionId,
        created_by: hostId,
      })
      .select("id")
      .maybeSingle();
    if (ins.data?.id) return ins.data.id as string;
    const re = await this.supabase
      .from("conversations")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("kind", "topic")
      .eq("context_type", "live")
      .eq("context_id", sessionId)
      .maybeSingle();
    return re.data?.id ?? null;
  }

  /**
   * Génère un vrai token LiveKit JWT pour rejoindre une room.
   * - role "host"    → canPublish + canSubscribe + roomAdmin, TTL 4h
   * - role "student" → canSubscribe only, TTL 1h
   *
   * ⚠️ SÉCURITÉ : le rôle n'est JAMAIS celui demandé par le client (`requestedRole`
   * n'est qu'un indice). Il est DÉRIVÉ ici de l'identité serveur — sinon n'importe
   * quel élève appellerait POST /lives/:id/token { role:"host" } et obtiendrait
   * canPublish + roomAdmin (publier sa caméra, couper les micros, admin de room).
   * Host légitime = l'hôte déclaré de la session (live_sessions.host_user_id) OU
   * un membre staff du tenant (owner/admin/teacher/secretariat/practitioner).
   *
   * La room est créée (ou retrouvée) via ensureRoom avant l'émission du token.
   * Le nom de room est scopé par tenant : {tenantSlug}_{sessionId} pour
   * garantir l'isolation multi-tenant au niveau LiveKit.
   */
  async generateToken(
    sessionId: string,
    userId: string,
    requestedRole?: "host" | "student",
    tenant?: { id?: string; slug?: string; userRole?: string | null },
  ) {
    // Charger la session : hôte légitime + slug pour le nom de room + état/started_at
    // pour l'enforcement de la durée (palier gratuit). 1 requête.
    const { data: session } = await this.supabase
      .from("live_sessions")
      .select("host_user_id, tenant_id, status, started_at, tenants(slug)")
      .eq("id", sessionId)
      .single();
    if (!session) throw new NotFoundException("Session introuvable");

    // Rôle EFFECTIF tranché côté serveur (le body est ignoré pour la sécurité).
    const STAFF = new Set(["owner", "admin", "teacher", "secretariat", "practitioner"]);
    const isHost =
      (session as any).host_user_id === userId ||
      STAFF.has(String(tenant?.userRole ?? "").toLowerCase());
    const role: "host" | "student" = isHost ? "host" : "student";

    // Garde-fou serveur : un participant (non-host) explicitement REJETÉ par l'hôte
    // ne reçoit pas de token LiveKit (la garde front est contournable via l'URL
    // directe ; celle-ci est la vraie barrière). Fail-open : sans entrée de salle
    // d'attente (live sans approbation), on délivre.
    if (role !== "host") {
      const { data: wr } = await this.supabase
        .from("live_waiting_room_entries")
        .select("status")
        .eq("live_session_id", sessionId)
        .eq("user_id", userId)
        .maybeSingle();
      if ((wr as any)?.status === "rejected") {
        throw new ForbiddenException("Accès refusé par l'hôte de cette session.");
      }
    }

    const slug = tenant?.slug ?? (session as any)?.tenants?.slug ?? sessionId;
    const roomName = LiveKitService.scopedRoomName(slug, sessionId);

    // ── Enforcement palier gratuit (Couche A) — barrière réelle, non contournable ──
    // Le front affiche les limites ; ICI on les APPLIQUE au mint du token LiveKit.
    // Payant/essai → limits.* = null → aucun bridage.
    const { limits } = await this.entitlements.resolveLimits(
      (session as any).tenant_id,
    );
    let cappedTtlSeconds: number | undefined;
    if (limits.maxLiveMinutes !== null) {
      const startedAt = (session as any).started_at
        ? new Date((session as any).started_at).getTime()
        : null;
      const isLive = (session as any).status === "live" && startedAt !== null;
      if (isLive) {
        const deadline = startedAt! + limits.maxLiveMinutes * 60_000;
        const remainingMs = deadline - Date.now();
        // (a) Durée écoulée → on n'émet plus AUCUN token (host inclus) : le live gratuit est clos.
        if (remainingMs <= 0) {
          throw new ForbiddenException(
            `Forfait gratuit : ce live a atteint sa limite de ${limits.maxLiveMinutes} minutes. Passez à un forfait LIRI pour des lives illimités.`,
          );
        }
        // Token capé au temps restant → tous les participants (host compris) sont
        // déconnectés à l'échéance des 3 min, même sans re-mint.
        cappedTtlSeconds = Math.max(30, Math.floor(remainingMs / 1000));
      } else {
        // Pas encore en direct : on plafonne quand même le token à la durée max
        // (la room gratuite ne vivra pas plus longtemps une fois lancée).
        cappedTtlSeconds = limits.maxLiveMinutes * 60;
      }
    }
    // (b) Participants : N max. L'hôte entre TOUJOURS (il anime sa room) ; on refuse
    //     le (N+1)e invité. listParticipantIdentities = [] si la room n'existe pas encore.
    if (limits.maxParticipants !== null && role !== "host") {
      const present = await this.liveKit.listParticipantIdentities(roomName);
      const alreadyIn = present.includes(userId);
      if (!alreadyIn && present.length >= limits.maxParticipants) {
        throw new ForbiddenException(
          `Forfait gratuit : ${limits.maxParticipants} participants maximum dans un live. Passez à un forfait LIRI pour accueillir plus de monde.`,
        );
      }
    }

    // Créer la room LiveKit si elle n'existe pas encore (idempotent)
    await this.liveKit.ensureRoom(roomName, sessionId, userId);

    // Émettre le token selon le rôle EFFECTIF (pas celui demandé), TTL capé en gratuit.
    const token =
      role === "host"
        ? await this.liveKit.generateHostToken(roomName, userId, undefined, cappedTtlSeconds ?? "4h")
        : await this.liveKit.generateParticipantToken(roomName, userId, undefined, cappedTtlSeconds ?? "1h");

    return { token, room: roomName, role, userId, requestedRole: requestedRole ?? null };
  }

  /**
   * Démarre l'egress UNE fois pour la session. Best-effort (avale les erreurs), NO-OP si
   * R2 non configuré (CF_R2_BUCKET absent) ou si un enregistrement a déjà été lancé.
   * Appelé par le WEBHOOK quand l'HÔTE rejoint la room (room ACTIVE → l'egress démarre).
   * ⚠️ NE PAS appeler à l'émission du token : la room est alors VIDE (le client de l'hôte
   * n'a pas encore publié) → LiveKit refuse l'egress composite → 'failed' (bug vécu).
   */
  async maybeStartRecording(tenantId: string, sessionId: string): Promise<void> {
    if (!process.env.CF_R2_BUCKET) return;
    try {
      const { data: existing } = await this.supabase
        .from("live_recordings")
        .select("id")
        .eq("live_session_id", sessionId)
        .in("status", ["recording", "completed", "stopped"])
        .limit(1)
        .maybeSingle();
      if (existing) return;
      await this.startRecording(tenantId, sessionId);
    } catch {
      /* best-effort : l'entrée en live ne doit jamais échouer à cause de l'egress */
    }
  }

  /**
   * Stable, tenant-scoped LiveKit room name from an external reference.
   * Exposed via Liri so domain engines (MEDOS, Mbolo, ...) never need to
   * reach into LiveKitService.scopedRoomName. Pure function — no I/O.
   */
  roomNameFor(tenantSlug: string, externalRef: string): string {
    return LiveKitService.scopedRoomName(tenantSlug, externalRef);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Liri — unified entry point for ALL engines that need a video room.
  //
  // Why this exists: the platform must have ONE authority for video
  // (LiveKit access, recording, replay, billing minutes). Engines like
  // MEDOS (teleconsultation), Mbolo (live shopping) and ISNA classes all
  // call this method instead of touching LiveKit directly. That gives:
  //   - Unified billing: tenant's video usage is the sum across engines.
  //   - Future-proofing: swap LiveKit for Daily/Jitsi in ONE place.
  //   - Consistent UX: same waiting room, same recording consent flow.
  //
  // The caller passes a stable `external_ref` (e.g. the MEDOS
  // med_teleconsult_session.id). Liri derives a deterministic LiveKit
  // room name from it, so re-calls for the same reference reuse the same
  // room.
  //
  // The caller remains responsible for its own access control (e.g. MEDOS
  // verifies the patient owns the appointment). Liri only knows "this
  // user wants to join this external_ref as host or guest".
  // ─────────────────────────────────────────────────────────────────────
  async issueTokenForSession(input: {
    /** Tenant UUID — required for the liri_sessions ledger. */
    tenantId: string;
    tenantSlug: string;
    /**
     * Stable identifier from the caller. Same value across re-joins so
     * everyone lands in the same LiveKit room. Two callers using the
     * same string would collide — use a UUID or compose `${type}_${id}`.
     */
    externalRef: string;
    /**
     * Business purpose. Used later for billing breakdown and replay UI
     * filtering. Free-form to allow new engines without enum changes.
     */
    purpose:
      | "school_class"
      | "medical_teleconsult"
      | "live_shopping"
      | "support_call"
      | string;
    userId: string;
    displayName?: string;
    /**
     * Host = practitioner, teacher, seller (canPublish + roomAdmin).
     * Guest = patient, student, viewer (canSubscribe only).
     */
    role: "host" | "guest";
    /**
     * When true, a `guest` is issued a PEER token (canPublish camera + mic,
     * but no roomAdmin) instead of the subscribe-only viewer token. Required
     * for two-way calls like a medical teleconsultation where the patient
     * must show their camera. Defaults to false so live-class viewers stay
     * publish-disabled. Ignored for `host` (always full publish).
     */
    guestCanPublish?: boolean;
    /**
     * Optional caller context (e.g. { appointment_id }, { product_id }).
     * Persisted on the liri_sessions row for later analytics.
     */
    metadata?: Record<string, unknown>;
  }): Promise<{
    sessionId: string;
    room: string;
    token: string;
    url: string;
    ttl: string;
    purpose: string;
  }> {
    const roomName = LiveKitService.scopedRoomName(
      input.tenantSlug,
      input.externalRef,
    );

    await this.liveKit.ensureRoom(roomName, input.externalRef, input.userId);

    const token =
      input.role === "host"
        ? await this.liveKit.generateHostToken(
            roomName,
            input.userId,
            input.displayName,
          )
        : input.guestCanPublish
          ? await this.liveKit.generatePeerToken(
              roomName,
              input.userId,
              input.displayName,
            )
          : await this.liveKit.generateParticipantToken(
              roomName,
              input.userId,
              input.displayName,
            );

    // Persist (or fetch) the Liri session row. The UNIQUE INDEX on
    // (tenant_id, external_ref) gives us upsert-semantics: the FIRST caller
    // (typically the host) creates the row, subsequent joiners hit the
    // conflict path and we read back the existing row.
    const sessionId = await this.recordLiriSession({
      tenantId: input.tenantId,
      purpose: input.purpose,
      externalRef: input.externalRef,
      roomName,
      hostUserId: input.userId,
      metadata: input.metadata,
    });

    return {
      sessionId,
      room: roomName,
      token,
      url: this.liveKit.getUrl(),
      ttl:
        input.role === "host" ? "4h" : input.guestCanPublish ? "2h" : "1h",
      purpose: input.purpose,
    };
  }

  /**
   * Insert-or-fetch the liri_sessions ledger row. Returns the session id so
   * callers can pass it back to endSession() when the call hangs up.
   */
  private async recordLiriSession(input: {
    tenantId: string;
    purpose: string;
    externalRef: string;
    roomName: string;
    hostUserId: string;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    const supabase = this.supabase;

    // Idempotent: ignore conflict on (tenant_id, external_ref) and then read.
    await supabase
      .from("liri_sessions")
      .upsert(
        {
          tenant_id: input.tenantId,
          purpose: input.purpose,
          external_ref: input.externalRef,
          room_name: input.roomName,
          host_user_id: input.hostUserId,
          metadata: (input.metadata ?? {}) as any,
        },
        { onConflict: "tenant_id,external_ref", ignoreDuplicates: true },
      );

    const { data } = await supabase
      .from("liri_sessions")
      .select("id")
      .eq("tenant_id", input.tenantId)
      .eq("external_ref", input.externalRef)
      .single();

    return (data as { id: string } | null)?.id ?? "";
  }

  /**
   * Mark a Liri session as ended. Sets ended_at and computes duration. Safe
   * to call multiple times (no-op if already ended). Returns the row or null
   * if not found.
   */
  async endLiriSession(
    tenantId: string,
    externalRef: string,
  ): Promise<{ duration_seconds: number; ended_at: string } | null> {
    const supabase = this.supabase;

    const { data: existing } = await supabase
      .from("liri_sessions")
      .select("id, started_at, ended_at")
      .eq("tenant_id", tenantId)
      .eq("external_ref", externalRef)
      .single();

    if (!existing) return null;
    const row = existing as any;
    if (row.ended_at) {
      return {
        duration_seconds: 0,
        ended_at: row.ended_at,
      };
    }

    const endedAt = new Date();
    const durationSec = Math.max(
      0,
      Math.floor(
        (endedAt.getTime() - new Date(row.started_at).getTime()) / 1000,
      ),
    );

    await supabase
      .from("liri_sessions")
      .update({
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSec,
      })
      .eq("id", row.id);

    return {
      duration_seconds: durationSec,
      ended_at: endedAt.toISOString(),
    };
  }

  /**
   * Close any open Liri session matching the given LiveKit room_name. Called
   * by the LiveKit webhook on `room_finished` so sessions don't leak when a
   * user just closes the tab without clicking "End call". Idempotent — no-op
   * if the row is already closed or doesn't exist (e.g. ISNA school sessions
   * aren't yet in this ledger and stay handled by live_sessions).
   */
  async endLiriSessionByRoomName(
    roomName: string,
  ): Promise<{ session_id: string; duration_seconds: number } | null> {
    const supabase = this.supabase;
    const { data } = await supabase
      .from('liri_sessions')
      .select('id, tenant_id, external_ref, started_at, ended_at')
      .eq('room_name', roomName)
      .single();
    if (!data) return null;
    const row = data as any;
    if (row.ended_at) {
      return { session_id: row.id, duration_seconds: 0 };
    }
    const endedAt = new Date();
    const durationSec = Math.max(
      0,
      Math.floor(
        (endedAt.getTime() - new Date(row.started_at).getTime()) / 1000,
      ),
    );
    await supabase
      .from('liri_sessions')
      .update({
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSec,
      })
      .eq('id', row.id);
    return { session_id: row.id, duration_seconds: durationSec };
  }

  /**
   * Aggregate consumption per purpose for a tenant inside [from, to].
   * Used by the admin UI to bill / show usage. Open sessions (no ended_at)
   * are excluded — only completed sessions count toward billing.
   */
  async getLiriConsumption(
    tenantId: string,
    from: string,
    to: string,
  ): Promise<
    Array<{
      purpose: string;
      session_count: number;
      total_seconds: number;
      total_minutes: number;
    }>
  > {
    const supabase = this.supabase;
    const { data } = await supabase
      .from("liri_sessions")
      .select("purpose, duration_seconds")
      .eq("tenant_id", tenantId)
      .gte("started_at", from)
      .lte("started_at", to)
      .not("ended_at", "is", null);

    const buckets: Record<string, { count: number; seconds: number }> = {};
    for (const row of data ?? []) {
      const r = row as { purpose: string; duration_seconds: number | null };
      const key = r.purpose;
      if (!buckets[key]) buckets[key] = { count: 0, seconds: 0 };
      buckets[key].count += 1;
      buckets[key].seconds += r.duration_seconds ?? 0;
    }
    return Object.entries(buckets).map(([purpose, b]) => ({
      purpose,
      session_count: b.count,
      total_seconds: b.seconds,
      total_minutes: Math.round(b.seconds / 60),
    }));
  }
}
