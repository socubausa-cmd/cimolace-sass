import { AuthService } from "../auth/auth.service";
export declare class MedFormsService {
    private auth;
    constructor(auth: AuthService);
    private get supabase();
    findAll(tenantId: string): Promise<any[]>;
    findOne(tenantId: string, id: string): Promise<any>;
    create(tenantId: string, dto: any): Promise<any>;
    submitResponse(tenantId: string, formId: string, patientId: string, responses: any): Promise<any>;
    getResponses(tenantId: string, formId: string): Promise<any[]>;
}
