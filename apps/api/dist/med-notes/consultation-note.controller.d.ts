import { ConsultationNoteService } from "./consultation-note.service";
export declare class ConsultationNoteController {
    private service;
    constructor(service: ConsultationNoteService);
    findByRecord(req: any, recordId: string): Promise<{
        data: any[];
    }>;
    create(req: any, recordId: string, body: any): Promise<{
        data: any;
    }>;
    update(req: any, id: string, body: any): Promise<{
        data: any;
    }>;
    sign(req: any, id: string): Promise<{
        data: any;
    }>;
    share(req: any, id: string, body: {
        is_shared: boolean;
    }): Promise<{
        data: any;
    }>;
}
