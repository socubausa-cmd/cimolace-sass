import { AuthService } from "../auth/auth.service";
export declare class MarketingService {
    private auth;
    constructor(auth: AuthService);
    private get supabase();
    getPromos(tenantId: string): Promise<any[]>;
    createPromo(tenantId: string, dto: any): Promise<any>;
    updatePromo(tenantId: string, id: string, dto: any): Promise<any>;
    deletePromo(tenantId: string, id: string): Promise<{
        ok: boolean;
    }>;
    getPopups(tenantId: string): Promise<any[]>;
    getBanners(tenantId: string): Promise<any[]>;
}
