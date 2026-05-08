import { AuthService } from "../auth/auth.service";
export declare class ConsultationNoteService {
    private authService;
    constructor(authService: AuthService);
    create(tenantId: string, data: any): Promise<any>;
    findByRecord(tenantId: string, recordId: string): Promise<any[]>;
    findOne(tenantId: string, id: string): Promise<any>;
    update(tenantId: string, id: string, updates: any): Promise<any>;
    sign(tenantId: string, id: string): Promise<any>;
    share(tenantId: string, id: string, shared: boolean): Promise<any>;
}
