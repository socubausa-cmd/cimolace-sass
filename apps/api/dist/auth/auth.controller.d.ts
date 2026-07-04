import { AuthService } from './auth.service';
import { TenantApiKeyService } from '../tenant/tenant-api-key.service';
import { TenantTokenDto } from './tenant-token.dto';
export declare class AuthController {
    private readonly authService;
    private readonly tenantApiKeyService;
    constructor(authService: AuthService, tenantApiKeyService: TenantApiKeyService);
    me(req: any): Promise<import("./auth.service").CimolaceIdentity>;
    tenantToken(dto: TenantTokenDto): Promise<{
        token: string;
        expiresAt: string;
        tenantSlug: string;
    }>;
}
