import { TenantService } from "./tenant.service";
import { UpdateBrandingDto } from "./update-branding.dto";
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
    brandingBySlug(slug: string): Promise<{
        slug: string;
        name: string;
        logo_url: string | null;
        brand_colors: Record<string, string>;
        site: Record<string, unknown> | null;
    } | null>;
    brandingByHost(host: string): Promise<{
        slug: string;
        name: string;
        logo_url: string | null;
        brand_colors: Record<string, string>;
    } | null>;
    updateOwnBranding(req: any, dto: UpdateBrandingDto): Promise<{
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
