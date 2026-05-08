import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { TenantService } from "../../tenant/tenant.service";

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private tenantService: TenantService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    if (!userId) throw new ForbiddenException("User not authenticated");
    const slug = (request.headers["x-tenant-slug"] as string) ?? undefined;
    const tenant = await this.tenantService.resolveTenant(userId, slug);
    if (!tenant) throw new ForbiddenException("No tenant access");
    request.tenant = tenant;
    return true;
  }
}
