import { AuthService } from "../auth/auth.service";
import { EmailEngineService } from "../email-engine/email-engine.service";
export declare class NotificationsService {
    private auth;
    private email;
    private readonly logger;
    constructor(auth: AuthService, email: EmailEngineService);
    private get supabase();
    getUserNotifications(tenantId: string, userId: string): Promise<any[]>;
    markRead(tenantId: string, notifId: string): Promise<any>;
    send(tenantId: string, userId: string, payload: {
        title: string;
        body: string;
        type: string;
        email?: boolean;
        actionUrl?: string;
    }): Promise<any>;
    private emailUser;
}
