import { MedProgramsService } from "./med-programs.service";
export declare class MedProgramsController {
    private svc;
    constructor(svc: MedProgramsService);
    findAll(req: any): Promise<{
        data: any[];
    }>;
    create(req: any, b: any): Promise<{
        data: any;
    }>;
    addStep(id: string, b: any): Promise<{
        data: any;
    }>;
    assign(req: any, id: string, b: any): Promise<{
        data: any;
    }>;
    findByPatient(req: any, pid: string): Promise<{
        data: any[];
    }>;
}
