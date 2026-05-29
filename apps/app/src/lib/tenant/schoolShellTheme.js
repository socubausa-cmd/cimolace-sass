import { defaultTenantBranding } from '@/lib/tenant/tenantBranding';

function hexToRgb(hex) {
  const raw = String(hex || '').replace('#', '').trim();
  if (!/^[0-9a-f]{6}$/i.test(raw)) return null;
  const value = Number.parseInt(raw, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function rgbTriplet(hex, fallback = '212 175 55') {
  const rgb = hexToRgb(hex);
  return rgb ? `${rgb.r} ${rgb.g} ${rgb.b}` : fallback;
}

export function buildSchoolShellTheme(branding = defaultTenantBranding) {
  const source = branding || defaultTenantBranding;
  const primary = source.primaryColor || defaultTenantBranding.primaryColor;
  const secondary = source.secondaryColor || defaultTenantBranding.secondaryColor;
  const accent = source.accentColor || defaultTenantBranding.accentColor;
  const background = source.backgroundColor || '#0F1117';
  const designSystem = source.designSystem && typeof source.designSystem === 'object' ? source.designSystem : {};
  const fontFamily = designSystem.fontFamily || designSystem.font_family || 'Inter, system-ui, sans-serif';
  const radius = designSystem.radius || designSystem.borderRadius || designSystem.border_radius || '12px';

  return {
    branding: source,
    cssVars: {
      '--school-primary': primary,
      '--school-secondary': secondary,
      '--school-accent': accent,
      '--school-background': background,
      '--school-primary-rgb': rgbTriplet(primary, '15 17 23'),
      '--school-secondary-rgb': rgbTriplet(secondary, '22 35 49'),
      '--school-accent-rgb': rgbTriplet(accent),
      '--school-shell-surface': 'rgba(15, 17, 23, 0.98)',
      '--school-shell-panel': 'rgba(18, 17, 26, 0.92)',
      '--school-shell-border': 'rgba(255, 255, 255, 0.08)',
      '--school-shell-muted': 'rgba(255, 255, 255, 0.44)',
      '--school-font-family': fontFamily,
      '--school-radius': radius,
    },
    railBackground:
      `linear-gradient(180deg, rgba(${rgbTriplet(primary, '15 17 23')} / 0.26), rgba(18,17,26,0.96))`,
    topBarBackground:
      `linear-gradient(90deg, rgba(${rgbTriplet(primary, '15 17 23')} / 0.30), rgba(15,17,23,0.98) 42%, rgba(${rgbTriplet(accent)} / 0.10))`,
    gridBackground: {
      background: background || '#0a0b0f',
      backgroundImage:
        `linear-gradient(rgba(${rgbTriplet(accent)} / 0.10) 1px, transparent 1px),`
        + `linear-gradient(90deg, rgba(${rgbTriplet(primary, '15 17 23')} / 0.16) 1px, transparent 1px)`,
      backgroundSize: '44px 44px',
    },
  };
}

export default buildSchoolShellTheme;
