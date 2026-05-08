import { NotificationsService } from "./notifications.service";
export declare class NotificationsController {
    private svc;
    constructor(svc: NotificationsService);
    getAll(req: any): Promise<{
        data: any[];
    }>;
    markRead(req: any, id: string): Promise<{
        data: any;
    }>;
    send(req: any, b: any): Promise<{
        data: any;
    }>;
}
