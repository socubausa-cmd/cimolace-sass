import { AuthService } from "../auth/auth.service";
export declare class TenantService {
    private authService;
    constructor(authService: AuthService);
    resolveTenant(userId: string, tenantSlug?: string): Promise<any>;
    resolveForUser(slug: string, userId: string): Promise<any>;
    getTenantBySlug(slug: string): Promise<{
        slug: any;
        name: any;
        logo_url: any;
        brand_colors: any;
        status: any;
        metadata: any;
    } | null>;
    getTenantByHost(host: string): Promise<{
        slug: any;
        name: any;
        logo_url: any;
        brand_colors: any;
        status: any;
    } | null>;
    getMineForUser(userId: string): Promise<{
        role: any;
        slug: any;
        name: any;
        infrastructure_type: any;
        status: any;
        logo_url: any;
        tenants: any;
    }[]>;
    getTenantById(tenantId: string): Promise<any>;
    updateTenantService(tenantId: string, serviceKey: string, active: boolean): Promise<any>;
    updateBranding(tenantId: string, dto: {
        name?: string;
        logo_url?: string;
        primary_domain?: string;
        brand_colors?: {
            primary?: string;
            secondary?: string;
            accent?: string;
        };
    }): Promise<any>;
}
