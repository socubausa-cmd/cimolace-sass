import { MedHealthService } from "./med-health.service";
export declare class MedHealthController {
    private svc;
    constructor(svc: MedHealthService);
    create(req: any, b: any): Promise<{
        data: any;
    }>;
    findByPatient(req: any, id: string): Promise<{
        data: any[];
    }>;
}
