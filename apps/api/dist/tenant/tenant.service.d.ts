import { AuthService } from "../auth/auth.service";
export declare class TenantService {
    private authService;
    constructor(authService: AuthService);
    resolveTenant(userId: string, tenantSlug?: string): Promise<any>;
    getTenantById(tenantId: string): Promise<any>;
}
