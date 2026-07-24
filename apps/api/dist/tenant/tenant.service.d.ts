import { AuthService } from "../auth/auth.service";
import { LiriEntitlementsService } from "../billing/liri-entitlements.service";
export declare function isEmbeddedTenant(tenant: any): boolean;
export declare function isPlatformOrigin(originOrReferer: string | undefined): boolean;
export declare class TenantService {
    private authService;
    private entitlements;
    constructor(authService: AuthService, entitlements: LiriEntitlementsService);
    resolveTenant(userId: string, tenantSlug?: string): Promise<any>;
    resolveForUser(slug: string, userId: string): Promise<any>;
    resolveTenantAllowNonMember(userId: string, tenantSlug?: string): Promise<any>;
    joinAsStudent(userId: string, slug: string, fromPlatformHost?: boolean): Promise<{
        ok: boolean;
        joined: boolean;
        role: any;
    } | {
        ok: boolean;
        joined: boolean;
        role?: undefined;
    } | null>;
    private sendWelcome;
    getTenantBySlug(slug: string): Promise<{
        slug: any;
        name: any;
        logo_url: any;
        brand_colors: any;
        status: any;
        metadata: any;
        primary_domain: any;
    } | null>;
    private getActiveTenantIdBySlug;
    getPublicCourses(slug: string): Promise<{
        id: any;
        title: any;
        description: any;
        category: any;
        price_cents: any;
        cycle: any;
        duration_weeks: any;
        image_url: any;
        mode: any;
    }[]>;
    getPublicOffers(slug: string): Promise<{
        key: any;
        label: any;
        tagline: any;
        description: any;
        price_cents: any;
        currency: any;
        billing_cycle: any;
        category: any;
        features: any;
        sort_order: any;
        access_model: any;
        metadata: any;
    }[]>;
    getTenantByHost(host: string): Promise<{
        slug: any;
        name: any;
        logo_url: any;
        brand_colors: any;
        status: any;
        metadata: any;
    } | null>;
    resolveTenantIdByOrigin(host: string): Promise<string | null>;
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
    updateTenantService(tenantId: string, serviceKey: string, active: boolean, actor?: string): Promise<any>;
    updateBranding(tenantId: string, dto: {
        name?: string;
        logo_url?: string;
        primary_domain?: string;
        brand_colors?: {
            primary?: string;
            secondary?: string;
            accent?: string;
        };
        site?: {
            description?: string;
            slogan?: string;
            vision?: string;
            website?: string;
        };
    }): Promise<any>;
    updateTenantSettings(tenantId: string, dto: {
        requiresStudentDossier?: boolean;
    }): Promise<any>;
    updateOsKnowledge(tenantId: string, knowledge: Record<string, unknown>): Promise<{} | null>;
}
