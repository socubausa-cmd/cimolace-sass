import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { LiveKitService } from "../livekit/livekit.service";

@Injectable()
export class LiveService {
  constructor(
    private auth: AuthService,
    private liveKit: LiveKitService,
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
    const slug = session.tenant_slug ?? "";
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
    // Charger la session : hôte légitime + slug pour le nom de room (1 requête).
    const { data: session } = await this.supabase
      .from("live_sessions")
      .select("host_user_id, tenant_id, tenants(slug)")
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

    // Créer la room LiveKit si elle n'existe pas encore (idempotent)
    await this.liveKit.ensureRoom(roomName, sessionId, userId);

    // Émettre le token selon le rôle EFFECTIF (pas celui demandé)
    const token =
      role === "host"
        ? await this.liveKit.generateHostToken(roomName, userId)
        : await this.liveKit.generateParticipantToken(roomName, userId);

    return { token, room: roomName, role, userId, requestedRole: requestedRole ?? null };
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
