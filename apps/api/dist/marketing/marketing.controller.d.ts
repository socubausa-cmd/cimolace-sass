import { MarketingService } from "./marketing.service";
export declare class MarketingController {
    private svc;
    constructor(svc: MarketingService);
    getPromos(req: any): Promise<{
        data: any[];
    }>;
    createPromo(req: any, b: any): Promise<{
        data: any;
    }>;
    updatePromo(req: any, id: string, b: any): Promise<{
        data: any;
    }>;
    deletePromo(req: any, id: string): Promise<{
        data: {
            ok: boolean;
        };
    }>;
    getPopups(req: any): Promise<{
        data: any[];
    }>;
    getBanners(req: any): Promise<{
        data: any[];
    }>;
}
