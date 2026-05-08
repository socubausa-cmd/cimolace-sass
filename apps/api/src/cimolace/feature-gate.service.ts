import { Injectable, ForbiddenException, CanActivate, ExecutionContext } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";

@Injectable()
export class FeatureGateService {
  constructor(private auth: AuthService) {}

  async isServiceActive(tenantId: string, serviceKey: string): Promise<boolean> {
    const supabase = this.auth.getClient();
    const { data } = await supabase.from("tenant_services").select("active").eq("tenant_id", tenantId).eq("service_key", serviceKey).single();
    return data?.active ?? false;
  }

  async assertServiceActive(tenantId: string, serviceKey: string) {
    const active = await this.isServiceActive(tenantId, serviceKey);
    if (!active) throw new ForbiddenException(`Service ${serviceKey} is not active for this tenant`);
  }

  async activateTemplate(tenantId: string, templateType: string) {
    const { INFRA_TEMPLATES } = await import("./service-catalog.service");
    const template = INFRA_TEMPLATES.find((t) => t.type === templateType);
    if (!template) throw new Error("Template not found");
    const supabase = this.auth.getClient();
    for (const engine of template.engines) {
      await supabase.from("tenant_services").upsert({ tenant_id: tenantId, service_key: engine, active: true }, { onConflict: "tenant_id,service_key" });
    }
    return { activated: template.engines.length, engines: template.engines };
  }
}
