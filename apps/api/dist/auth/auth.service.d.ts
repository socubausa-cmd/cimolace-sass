import { SupabaseClient } from '@supabase/supabase-js';
export interface MedosTokenPayload {
    sub: string;
    email: string;
    role: string;
    tenant_id: string;
    tenant_slug: string;
    iss: 'medos';
}
export declare class AuthService {
    private supabase;
    private readonly jwtSecret;
    constructor();
    verifyToken(token: string): Promise<{
        id: string;
        email: string;
        role: string;
    } | null>;
    generateMedosToken(payload: Omit<MedosTokenPayload, 'iss'>): string;
    verifyMedosToken(token: string): MedosTokenPayload | null;
    safeCompare(a: string, b: string): boolean;
    getClient(): SupabaseClient;
}
