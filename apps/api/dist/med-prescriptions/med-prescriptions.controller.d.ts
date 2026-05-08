import { MedPrescriptionsService } from "./med-prescriptions.service";
export declare class MedPrescriptionsController {
    private svc;
    constructor(svc: MedPrescriptionsService);
    create(req: any, b: any): Promise<{
        data: any;
    }>;
    findByRecord(req: any, rid: string): Promise<{
        data: any[];
    }>;
    sign(req: any, id: string): Promise<{
        data: any;
    }>;
}
