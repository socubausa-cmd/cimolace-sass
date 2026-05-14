import { SetMetadata } from '@nestjs/common';

export type TenantRole =
  | 'owner'
  | 'admin'
  | 'teacher'
  | 'secretariat'
  | 'support'
  | 'student'
  // MedOS roles
  | 'practitioner'
  | 'clinic_admin'
  | 'receptionist'
  | 'patient';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: TenantRole[]) => SetMetadata(ROLES_KEY, roles);
