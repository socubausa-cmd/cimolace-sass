export type TenantRole = 'owner' | 'admin' | 'member' | 'viewer' | 'teacher' | 'practitioner' | 'clinic_admin' | 'receptionist' | 'patient' | 'secretariat';
export declare const ROLES_KEY = "roles";
export declare const Roles: (...roles: TenantRole[]) => import("@nestjs/common").CustomDecorator<string>;
