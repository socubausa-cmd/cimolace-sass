import { SetMetadata } from "@nestjs/common";

export type TenantRole = 'owner' | 'admin' | 'member' | 'viewer' | 'teacher' | 'practitioner' | 'clinic_admin' | 'receptionist' | 'patient' | 'secretariat';

export const ROLES_KEY = "roles";
export const Roles = (...roles: TenantRole[]) => SetMetadata(ROLES_KEY, roles);
