import { MedGdprService } from "./med-gdpr.service";
export declare class MedGdprController {
    private svc;
    constructor(svc: MedGdprService);
    export(req: any, id: string): Promise<{
        data: {
            patient: any;
            notes: any[];
            prescriptions: any[];
            forms: any[];
            health: any[];
            exportedAt: string;
        };
    }>;
    anonymize(req: any, id: string): Promise<{
        data: {
            success: boolean;
        };
    }>;
}
