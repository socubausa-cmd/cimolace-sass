import { AuthService } from "../auth/auth.service";
import { LiveKitService } from "../livekit/livekit.service";
import { LiriEntitlementsService } from "../billing/liri-entitlements.service";
import { UsageService } from "../usage/usage.service";
export declare class LiveService {
    private auth;
    private liveKit;
    private entitlements;
    private usage;
    private readonly logger;
    constructor(auth: AuthService, liveKit: LiveKitService, entitlements: LiriEntitlementsService, usage: UsageService);
    private get supabase();
    createSession(tenantId: string, data: any): Promise<any>;
    findAll(tenantId: string): Promise<any[]>;
    findOne(tenantId: string, sessionId: string): Promise<any>;
    startSession(tenantId: string, sessionId: string): Promise<any>;
    endSession(tenantId: string, sessionId: string): Promise<any>;
    startRecording(tenantId: string, sessionId: string): Promise<{
        recording: any;
        egressId: string | null;
        recording_active: boolean;
    }>;
    startRecordingForTeleconsult(tenantId: string, sessionId: string): Promise<{
        recording: any;
        egressId: string | null;
        recording_active: boolean;
    }>;
    private _startEgressForSession;
    stopRecording(tenantId: string, sessionId: string): Promise<{
        stopped: boolean;
        recordingId: any;
        recording_active: boolean;
    }>;
    private replayPublishStatus;
    private isSessionEditor;
    publishReplay(tenantId: string, sessionId: string, opts?: {
        force?: "published" | "pending_review";
        actorId?: string;
    }): Promise<{
        published: boolean;
        reason: "teleconsult";
        workflow_status?: undefined;
        forumPosted?: undefined;
        state?: undefined;
    } | {
        published: boolean;
        reason: "no_recording";
        workflow_status?: undefined;
        forumPosted?: undefined;
        state?: undefined;
    } | {
        published: boolean;
        workflow_status: "published" | "pending_review";
        forumPosted: boolean;
        state: any;
        reason?: undefined;
    }>;
    private canViewReplay;
    resolveReplayPlaybackUrl(sessionId: string, userId: string): Promise<string>;
    getTeleconsultRecordingState(sessionId: string): Promise<{
        recording: boolean;
        hasReplay: boolean;
        startedAt: string | null;
        completedAt: string | null;
        durationSeconds: number | null;
    }>;
    resolveTeleconsultReplayUrl(sessionId: string): Promise<string | null>;
    unpublishReplay(tenantId: string, sessionId: string, actorId?: string): Promise<{
        unpublished: boolean;
        state: any;
    }>;
    private static REPLAY_MARK;
    private postReplayToForum;
    private removeReplayFromForum;
    private resolveLiveTopicId;
    private resolveMemberCycle;
    generateToken(sessionId: string, userId: string, requestedRole?: "host" | "student", tenant?: {
        id?: string;
        slug?: string;
        userRole?: string | null;
    }): Promise<{
        token: string;
        room: string;
        role: "student" | "host";
        userId: string;
        requestedRole: "student" | "host" | null;
    }>;
    createPublicGuestPass(tenantId: string, sessionId: string, userId: string): Promise<{
        passId: any;
    }>;
    private resolveGuestInvite;
    generateGuestLiveToken(sessionId: string, inviteId: string, tenantSlug?: string): Promise<{
        token: string;
        room: string;
        role: "guest";
        identity: string;
    }>;
    getPublicGuestInfo(sessionId: string, inviteId: string, tenantSlug?: string): Promise<{
        id: any;
        title: any;
        description: any;
        session_type: any;
        status: any;
        scheduled_at: any;
        started_at: any;
        cover_image_url: any;
        host_name: string | null;
        tenant: {
            slug: any;
            name: any;
        };
    }>;
    createLiveSessionInvite(tenantId: string, hostId: string, sessionId: string, dto: {
        display_name?: string;
        email?: string;
        relationship?: string;
        invited_user_id?: string;
        kind?: "guest" | "member";
    }): Promise<any>;
    listLiveSessionInvites(tenantId: string, sessionId: string): Promise<any[]>;
    private updateLiveInviteStatus;
    admitLiveSessionInvite(tenantId: string, sessionId: string, inviteId: string): Promise<any>;
    revokeLiveSessionInvite(tenantId: string, sessionId: string, inviteId: string): Promise<any>;
    private sendLiveInviteEmail;
    maybeStartRecording(tenantId: string, sessionId: string): Promise<void>;
    roomNameFor(tenantSlug: string, externalRef: string): string;
    listRoomParticipants(tenantSlug: string, externalRef: string): Promise<string[]>;
    closeRoom(tenantSlug: string, externalRef: string): Promise<void>;
    muteParticipant(tenantSlug: string, externalRef: string, identity: string): Promise<number>;
    removeParticipant(tenantSlug: string, externalRef: string, identity: string): Promise<void>;
    issueTokenForSession(input: {
        tenantId: string;
        tenantSlug: string;
        externalRef: string;
        purpose: "school_class" | "medical_teleconsult" | "live_shopping" | "support_call" | string;
        userId: string;
        displayName?: string;
        role: "host" | "guest";
        guestCanPublish?: boolean;
        metadata?: Record<string, unknown>;
    }): Promise<{
        sessionId: string;
        room: string;
        token: string;
        url: string;
        ttl: string;
        purpose: string;
    }>;
    private recordLiriSession;
    endLiriSession(tenantId: string, externalRef: string): Promise<{
        duration_seconds: number;
        ended_at: string;
    } | null>;
    endLiriSessionByRoomName(roomName: string): Promise<{
        session_id: string;
        duration_seconds: number;
        tenant_id: string | null;
    } | null>;
    getLiriConsumption(tenantId: string, from: string, to: string): Promise<Array<{
        purpose: string;
        session_count: number;
        total_seconds: number;
        total_minutes: number;
    }>>;
}
