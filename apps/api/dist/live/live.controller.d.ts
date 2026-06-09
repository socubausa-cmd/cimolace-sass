import { LiveService } from "./live.service";
export declare class LiveController {
    private svc;
    constructor(svc: LiveService);
    create(req: any, b: any): Promise<{
        data: any;
    }>;
    findAll(req: any): Promise<{
        data: any[];
    }>;
    findOne(req: any, id: string): Promise<{
        data: any;
    }>;
    token(req: any, id: string, b: any): Promise<{
        data: {
            token: string;
            room: string;
            role: "host" | "student";
            userId: string;
        };
    }>;
    start(req: any, id: string): Promise<{
        data: any;
    }>;
    end(req: any, id: string): Promise<{
        data: any;
    }>;
    recStart(req: any, id: string): Promise<{
        data: {
            recording: any;
            egressId: string | null;
            recording_active: boolean;
        };
    }>;
    recStop(req: any, id: string): Promise<{
        data: {
            stopped: boolean;
            recordingId: any;
            recording_active: boolean;
        };
    }>;
}
