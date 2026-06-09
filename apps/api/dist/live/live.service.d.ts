import { AuthService } from "../auth/auth.service";
import { LiveKitService } from "../livekit/livekit.service";
export declare class LiveService {
    private auth;
    private liveKit;
    constructor(auth: AuthService, liveKit: LiveKitService);
    private get supabase();
    createSession(tenantId: string, data: any): Promise<any>;
    findAll(tenantId: string): Promise<any[]>;
    findOne(tenantId: string, sessionId: string): Promise<any>;
    startSession(tenantId: string, sessionId: string): Promise<any>;
    endSession(tenantId: string, sessionId: string): Promise<any>;
    generateToken(sessionId: string, userId: string, role: "host" | "student", tenantSlug?: string): Promise<{
        token: string;
        room: string;
        role: "host" | "student";
        userId: string;
    }>;
    roomNameFor(tenantSlug: string, externalRef: string): string;
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
    } | null>;
    getLiriConsumption(tenantId: string, from: string, to: string): Promise<Array<{
        purpose: string;
        session_count: number;
        total_seconds: number;
        total_minutes: number;
    }>>;
}
