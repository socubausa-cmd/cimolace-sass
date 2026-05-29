import { Injectable, NotFoundException } from "@nestjs/common";
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
   * Génère un vrai token LiveKit JWT pour rejoindre une room.
   * - role "host"    → canPublish + canSubscribe + roomAdmin, TTL 4h
   * - role "student" → canSubscribe only, TTL 1h
   *
   * La room est créée (ou retrouvée) via ensureRoom avant l'émission du token.
   * Le nom de room est scopé par tenant : {tenantSlug}_{sessionId} pour
   * garantir l'isolation multi-tenant au niveau LiveKit.
   */
  async generateToken(
    sessionId: string,
    userId: string,
    role: "host" | "student",
    tenantSlug?: string,
  ) {
    // Récupérer la session pour obtenir le tenant_slug si non fourni
    let slug = tenantSlug ?? "";
    if (!slug) {
      const { data: session } = await this.supabase
        .from("live_sessions")
        .select("tenant_id, tenants(slug)")
        .eq("id", sessionId)
        .single();
      slug = (session as any)?.tenants?.slug ?? sessionId;
    }

    const roomName = LiveKitService.scopedRoomName(slug, sessionId);

    // Créer la room LiveKit si elle n'existe pas encore (idempotent)
    await this.liveKit.ensureRoom(roomName, sessionId, userId);

    // Émettre le token selon le rôle
    const token =
      role === "host"
        ? await this.liveKit.generateHostToken(roomName, userId)
        : await this.liveKit.generateParticipantToken(roomName, userId);

    return { token, room: roomName, role, userId };
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
      ttl: input.role === "host" ? "4h" : "1h",
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
