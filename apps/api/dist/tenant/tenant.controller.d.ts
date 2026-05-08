import { TenantService } from "./tenant.service";
export declare class TenantController {
    private tenantService;
    constructor(tenantService: TenantService);
    current(req: any): Promise<{
        data: any;
    }>;
}
