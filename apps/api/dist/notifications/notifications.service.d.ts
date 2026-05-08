import { AuthService } from "../auth/auth.service";
export declare class NotificationsService {
    private auth;
    constructor(auth: AuthService);
    private get supabase();
    getUserNotifications(tenantId: string, userId: string): Promise<any[]>;
    markRead(tenantId: string, notifId: string): Promise<any>;
    send(tenantId: string, userId: string, payload: {
        title: string;
        body: string;
        type: string;
    }): Promise<any>;
}
