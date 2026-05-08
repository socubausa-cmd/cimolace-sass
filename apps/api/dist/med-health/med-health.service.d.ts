import { AuthService } from "../auth/auth.service";
export declare class MedHealthService {
    private auth;
    constructor(auth: AuthService);
    private get supabase();
    create(tenantId: string, data: any): Promise<any>;
    findByPatient(tenantId: string, patientUserId: string): Promise<any[]>;
}
