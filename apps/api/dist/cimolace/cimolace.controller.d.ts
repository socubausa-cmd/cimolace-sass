import { ServiceCatalogService } from "./service-catalog.service";
import { FeatureGateService } from "./feature-gate.service";
export declare class CimolaceController {
    private catalog;
    private gate;
    constructor(catalog: ServiceCatalogService, gate: FeatureGateService);
    getCatalog(): Promise<{
        data: {
            key: string;
            name: string;
            cat: string;
            desc: string;
            free: boolean;
        }[];
    }>;
    getTemplates(): Promise<{
        data: {
            type: string;
            name: string;
            icon: string;
            planDefault: string;
            engines: string[];
        }[];
    }>;
    getTenantServices(req: any): Promise<{
        data: {
            service_key: any;
            active: any;
        }[];
    }>;
    toggle(req: any, key: string, b: any): Promise<{
        data: any;
    }>;
    activateTemplate(req: any, type: string): Promise<{
        data: {
            activated: number;
            engines: string[];
        };
    }>;
}
