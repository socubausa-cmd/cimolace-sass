import { AuthService } from "../auth/auth.service";
export declare class MedChartingService {
    private auth;
    constructor(auth: AuthService);
    transcribe(tenantId: string, audioUrl: string): Promise<{
        jobId: string;
        status: string;
        audioUrl: string;
    }>;
    generateNote(tenantId: string, transcript: string): Promise<any>;
    regenerate(tenantId: string, noteId: string): Promise<any>;
}
