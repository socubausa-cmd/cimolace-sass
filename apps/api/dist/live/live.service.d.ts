import { AuthService } from "../auth/auth.service";
export declare class LiveService {
    private auth;
    constructor(auth: AuthService);
    private get supabase();
    createSession(tenantId: string, data: any): Promise<any>;
    findAll(tenantId: string): Promise<any[]>;
    generateToken(sessionId: string, userId: string, role: "host" | "student"): Promise<{
        token: string;
        room: string;
        role: "host" | "student";
        userId: string;
    }>;
}
