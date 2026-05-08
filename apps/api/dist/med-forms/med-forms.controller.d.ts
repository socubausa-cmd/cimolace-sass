import { MedFormsService } from "./med-forms.service";
export declare class MedFormsController {
    private svc;
    constructor(svc: MedFormsService);
    findAll(req: any): Promise<{
        data: any[];
    }>;
    findOne(req: any, id: string): Promise<{
        data: any;
    }>;
    create(req: any, b: any): Promise<{
        data: any;
    }>;
    submit(req: any, id: string, b: any): Promise<{
        data: any;
    }>;
    getResponses(req: any, id: string): Promise<{
        data: any[];
    }>;
}
