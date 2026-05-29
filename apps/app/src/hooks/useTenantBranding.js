import { useMemo } from 'react';
import { normalizeTenantBranding } from '@/lib/tenant/tenantBranding';
import { buildSchoolShellTheme } from '@/lib/tenant/schoolShellTheme';
import { useTenantContext } from '@/hooks/useTenantModules';

export function useTenantBranding(options = {}) {
  const context = useTenantContext(options);
  const branding = useMemo(() => normalizeTenantBranding(context.tenant), [context.tenant]);
  const shellTheme = useMemo(() => buildSchoolShellTheme(branding), [branding]);

  return {
    ...context,
    branding,
    shellTheme,
    cssVars: {
      '--tenant-primary': branding.primaryColor,
      '--tenant-secondary': branding.secondaryColor,
      '--tenant-accent': branding.accentColor,
      '--tenant-background': branding.backgroundColor,
      ...shellTheme.cssVars,
    },
  };
}

export default useTenantBranding;
