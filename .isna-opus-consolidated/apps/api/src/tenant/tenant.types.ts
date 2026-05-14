import type { TenantRole } from '../common/decorators/roles.decorator';

export type BrandColors = {
  primary?: string;
  secondary?: string;
  accent?: string;
};

export type TenantContext = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  primary_domain: string | null;
  logo_url: string | null;
  brand_colors: BrandColors | null;
  infrastructure_type?: string | null;
  userRole: TenantRole;
};
