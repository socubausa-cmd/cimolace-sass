import { AuthService } from "../auth/auth.service";
export declare class MedGdprService {
    private auth;
    constructor(auth: AuthService);
    private get supabase();
    exportPatientData(tenantId: string, recordId: string): Promise<{
        patient: any;
        notes: any[];
        prescriptions: any[];
        forms: any[];
        health: any[];
        exportedAt: string;
    }>;
    anonymize(tenantId: string, recordId: string): Promise<{
        success: boolean;
    }>;
}
