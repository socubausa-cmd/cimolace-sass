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
  }): Promise<{
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

    // TODO(P5.1): persist a liri_sessions row { tenant_id, purpose,
    // external_ref, user_id, role, started_at } for billing minutes.
    // Skipped for now — requires a migration. The MEDOS side already
    // tracks med_teleconsult_sessions with its own metadata.

    return {
      room: roomName,
      token,
      url: this.liveKit.getUrl(),
      ttl: input.role === "host" ? "4h" : "1h",
      purpose: input.purpose,
    };
  }
}
