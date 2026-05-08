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
    token(req: any, id: string, b: any): Promise<{
        data: {
            token: string;
            room: string;
            role: "host" | "student";
            userId: string;
        };
    }>;
}
