import { PatientRecordService } from "./patient-record.service";
export declare class PatientRecordController {
    private service;
    constructor(service: PatientRecordService);
    create(req: any, body: any): Promise<{
        data: any;
    }>;
    findAll(req: any): Promise<{
        data: any[];
    }>;
    findOne(req: any, id: string): Promise<{
        data: any;
    }>;
    update(req: any, id: string, body: any): Promise<{
        data: any;
    }>;
}
