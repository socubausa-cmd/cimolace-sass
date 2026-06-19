import { NotificationsService } from "./notifications.service";
export declare class NotificationsController {
    private svc;
    constructor(svc: NotificationsService);
    getAll(req: any): Promise<any[]>;
    markRead(req: any, id: string): Promise<any>;
    send(req: any, b: any): Promise<any>;
}
