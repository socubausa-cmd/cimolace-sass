import { SupabaseClient } from "@supabase/supabase-js";
export declare class AuthService {
    private supabase;
    constructor();
    verifyToken(token: string): Promise<{
        id: string;
        email: string | undefined;
    } | null>;
    getClient(): SupabaseClient;
}
