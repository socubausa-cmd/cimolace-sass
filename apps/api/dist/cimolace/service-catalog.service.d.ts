import { AuthService } from "../auth/auth.service";
export declare const ENGINE_CATALOG: {
    key: string;
    name: string;
    cat: string;
    desc: string;
    free: boolean;
}[];
export declare const INFRA_TEMPLATES: {
    type: string;
    name: string;
    icon: string;
    planDefault: string;
    engines: string[];
}[];
export declare class ServiceCatalogService {
    private auth;
    constructor(auth: AuthService);
    getCatalog(): {
        key: string;
        name: string;
        cat: string;
        desc: string;
        free: boolean;
    }[];
    getTemplates(): {
        type: string;
        name: string;
        icon: string;
        planDefault: string;
        engines: string[];
    }[];
    getTenantServices(tenantId: string): Promise<{
        service_key: any;
        active: any;
    }[]>;
    toggleService(tenantId: string, serviceKey: string, active: boolean): Promise<any>;
}
