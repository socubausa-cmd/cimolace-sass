import { SupabaseClient } from '@supabase/supabase-js';
export interface MedosTokenPayload {
    sub: string;
    email: string;
    role: string;
    tenant_id: string;
    tenant_slug: string;
    iss: 'medos';
}
export interface CimolaceIdentity {
    id: string;
    email: string;
    role: string;
    cimolace_staff: boolean;
    metadata: Record<string, unknown>;
}
export declare class AuthService {
    private supabase;
    private readonly jwtSecret;
    private readonly cimolaceAdminEmails;
    constructor();
    verifyToken(token: string): Promise<{
        id: string;
        email: string;
        role: string;
        user_metadata: Record<string, unknown>;
        app_metadata: Record<string, unknown>;
    } | null>;
    resolveCimolaceIdentity(user: {
        id: string;
        email?: string;
        role?: string;
        user_metadata?: Record<string, unknown> | null;
        app_metadata?: Record<string, unknown> | null;
    }): Promise<CimolaceIdentity>;
    generateMedosToken(payload: Omit<MedosTokenPayload, 'iss'>): string;
    verifyMedosToken(token: string): MedosTokenPayload | null;
    safeCompare(a: string, b: string): boolean;
    getClient(): SupabaseClient;
}
