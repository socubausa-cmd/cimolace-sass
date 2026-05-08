import { AuthService } from "../auth/auth.service";
export declare class FeatureGateService {
    private auth;
    constructor(auth: AuthService);
    isServiceActive(tenantId: string, serviceKey: string): Promise<boolean>;
    assertServiceActive(tenantId: string, serviceKey: string): Promise<void>;
    activateTemplate(tenantId: string, templateType: string): Promise<{
        activated: number;
        engines: string[];
    }>;
}
