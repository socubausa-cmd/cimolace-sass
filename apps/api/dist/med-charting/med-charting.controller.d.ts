import { MedChartingService } from "./med-charting.service";
export declare class MedChartingController {
    private svc;
    constructor(svc: MedChartingService);
    transcribe(req: any, b: any): Promise<{
        data: {
            jobId: string;
            status: string;
            audioUrl: string;
        };
    }>;
    generate(req: any, b: any): Promise<{
        data: any;
    }>;
    regenerate(req: any, id: string): Promise<{
        data: any;
    }>;
}
