import { TenantService } from "./tenant.service";
import { UpdateBrandingDto } from "./update-branding.dto";
import { UpdateTenantSettingsDto } from "./update-tenant-settings.dto";
export declare class TenantController {
    private tenantService;
    constructor(tenantService: TenantService);
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
        primary_domain: string | null;
    } | null>;
    brandingByHost(host: string): Promise<{
        slug: string;
        name: string;
        logo_url: string | null;
        brand_colors: Record<string, string>;
        requiresStudentDossier: boolean | null;
    } | null>;
    updateOwnBranding(req: any, dto: UpdateBrandingDto): Promise<{
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
    toggleService(tenantId: string, serviceKey: string, body: {
        active?: boolean;
    }): Promise<{
        data: any;
    }>;
}
