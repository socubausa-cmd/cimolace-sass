import { AuthService } from "../auth/auth.service";
export declare class MedProgramsService {
    private auth;
    constructor(auth: AuthService);
    private get supabase();
    findAll(tenantId: string): Promise<any[]>;
    create(tenantId: string, dto: any): Promise<any>;
    addStep(programId: string, step: any): Promise<any>;
    assign(tenantId: string, programId: string, patientId: string, recordId: string): Promise<any>;
    findByPatient(tenantId: string, patientId: string): Promise<any[]>;
}
