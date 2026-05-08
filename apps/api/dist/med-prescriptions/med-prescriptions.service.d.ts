import { AuthService } from "../auth/auth.service";
export declare class MedPrescriptionsService {
    private auth;
    constructor(auth: AuthService);
    private get supabase();
    create(tenantId: string, data: any): Promise<any>;
    findByRecord(tenantId: string, recordId: string): Promise<any[]>;
    sign(tenantId: string, id: string): Promise<any>;
}
