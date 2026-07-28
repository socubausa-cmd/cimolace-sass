import { SupabaseClient } from '@supabase/supabase-js';
export interface MedosTokenPayload {
    sub: string;
    email: string;
    role: string;
    tenant_id: string;
    tenant_slug: string;
    iss: 'medos';
    imp?: true;
    impersonator?: string;
    imp_reason?: string;
}
export interface CimolaceIdentity {
    id: string;
    email: string;
    role: string;
    cimolace_staff: boolean;
    metadata: Record<string, unknown>;
}
export declare function roleRank(role: string | null | undefined): number;
export declare function membershipToMedosRole(role: string | null): string;
export declare function capMedosRole(membershipRole: string | null, requestedRole: string): string;
export declare class AuthService {
    private supabase;
    private readonly jwtSecret;
    private readonly supabaseJwtSecret;
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
    resolveCappedMedosRole(tenantId: string, userId: string, requestedRole: string): Promise<string>;
    generateImpersonationToken(payload: {
        operatorId: string;
        operatorEmail: string;
        tenantId: string;
        tenantSlug: string;
        role: string;
        reason: string;
    }, expiresInMinutes: number): string;
    verifyMedosToken(token: string): MedosTokenPayload | null;
    safeCompare(a: string, b: string): boolean;
    getClient(): SupabaseClient;
}
