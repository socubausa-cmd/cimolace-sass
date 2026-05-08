import { AuthService } from "../auth/auth.service";
export declare class PatientRecordService {
    private authService;
    constructor(authService: AuthService);
    create(tenantId: string, data: any): Promise<any>;
    findAll(tenantId: string): Promise<any[]>;
    findOne(tenantId: string, id: string): Promise<any>;
    update(tenantId: string, id: string, updates: any): Promise<any>;
}
