import { LiriEntitlementsService } from "../billing/liri-entitlements.service";
import { TenantService } from "./tenant.service";
import { UpdateBrandingDto } from "./update-branding.dto";
import { UpdateTenantSettingsDto } from "./update-tenant-settings.dto";
export declare class TenantController {
    private tenantService;
    private entitlements;
    constructor(tenantService: TenantService, entitlements: LiriEntitlementsService);
    current(req: any): Promise<{
        data: any;
    }>;
    mine(req: any): Promise<{
        data: {
            role: any;
            slug: any;
            name: any;
            infrastructure_type: any;
            status: any;
            logo_url: any;
            tenants: any;
        }[];
    }>;
    join(req: any, slug: string): Promise<{
        data: {
            ok: boolean;
            joined: boolean;
            role: any;
        } | {
            ok: boolean;
            joined: boolean;
            role?: undefined;
        };
    }>;
    brandingBySlug(slug: string): Promise<{
        slug: string;
        name: string;
        logo_url: string | null;
        brand_colors: Record<string, string>;
        site: Record<string, unknown> | null;
        requiresStudentDossier: boolean | null;
        embedded: boolean;
        public_slug: string;
        canonical_slug: string;
        primary_domain: string | null;
    } | null>;
    publicCourses(slug: string): Promise<{
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
    publicOffers(slug: string): Promise<{
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
    brandingByHost(host: string): Promise<{
        slug: string;
        name: string;
        logo_url: string | null;
        brand_colors: Record<string, string>;
        requiresStudentDossier: boolean | null;
    } | null>;
    osKnowledgeByHost(host: string): Promise<{} | null>;
    osKnowledgeBySlug(slug: string): Promise<{} | null>;
    currentOsKnowledge(req: any): Promise<{} | null>;
    updateOwnOsKnowledge(req: any, body: {
        knowledge?: Record<string, unknown>;
    } | Record<string, unknown>): Promise<{} | null>;
    updateOwnBranding(req: any, dto: UpdateBrandingDto): Promise<{
        data: any;
    }>;
    activateOwnSchool(req: any, body: {
        active?: boolean;
    }): Promise<{
        data: any;
    }>;
    updateOwnSettings(req: any, dto: UpdateTenantSettingsDto): Promise<{
        data: any;
    }>;
    updateBranding(tenantId: string, dto: UpdateBrandingDto): Promise<{
        data: any;
    }>;
}
export declare class AdminTenantServicesController {
    private tenantService;
    constructor(tenantService: TenantService);
    toggleService(req: any, tenantId: string, serviceKey: string, body: {
        active?: boolean;
    }): Promise<{
        data: any;
    }>;
}
