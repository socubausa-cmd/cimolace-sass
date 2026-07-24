import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantService } from '../../tenant/tenant.service';
export declare class TenantGuard implements CanActivate {
    private readonly tenantService;
    private readonly reflector;
    constructor(tenantService: TenantService, reflector: Reflector);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
