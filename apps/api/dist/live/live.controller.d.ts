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
            role: "student" | "host";
            userId: string;
            requestedRole: "student" | "host" | null;
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
    replayPublish(req: any, id: string): Promise<{
        data: {
            published: boolean;
            reason: "no_recording";
            workflow_status?: undefined;
            forumPosted?: undefined;
            state?: undefined;
        } | {
            published: boolean;
            workflow_status: "published" | "pending_review";
            forumPosted: boolean;
            state: any;
            reason?: undefined;
        };
    }>;
    replayUnpublish(req: any, id: string): Promise<{
        data: {
            unpublished: boolean;
            state: any;
        };
    }>;
}
