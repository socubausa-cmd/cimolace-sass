/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE BRANDING CONFIGURATION - ISNA
 * Configuration de branding spécifique pour ISNA
 * ═══════════════════════════════════════════════════════════════
 */

export const isnaBrandingConfig = {
  // Couleurs
  colors: {
    primary: '#1a5f7a',
    secondary: '#2c3e50',
    accent: '#e74c3c',
    success: '#27ae60',
    warning: '#f39c12',
    danger: '#c0392b',
    info: '#3498db',
    background: '#f8f9fa',
    surface: '#ffffff',
    text: '#2c3e50',
    textSecondary: '#7f8c8d',
    border: '#e0e0e0',
  },
  
  // Typography
  typography: {
    fontFamily: {
      heading: 'Inter, system-ui, sans-serif',
      body: 'Inter, system-ui, sans-serif',
      mono: 'Fira Code, monospace',
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  
  // Spacing
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  
  // Border radius
  borderRadius: {
    none: '0',
    sm: '0.125rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    full: '9999px',
  },
  
  // Shadows
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  },
  
  // Logo
  logo: {
    url: '/logos/isna-logo.png',
    alt: 'ISNA - Institut Supérieur de Nutrition Alimentaire',
    width: 150,
    height: 50,
  },
  
  // Favicon
  favicon: {
    url: '/favicons/isna-favicon.ico',
  },
  
  // Images
  images: {
    hero: '/images/isna-hero.jpg',
    background: '/images/isna-background.jpg',
    patterns: {
      default: '/images/patterns/isna-pattern.png',
    },
  },
  
  // Social media
  social: {
    facebook: 'https://facebook.com/isna.pro',
    instagram: 'https://instagram.com/isna.pro',
    linkedin: 'https://linkedin.com/company/isna-pro',
    twitter: 'https://twitter.com/isna_pro',
    youtube: 'https://youtube.com/@isna-pro',
  },
  
  // Legal
  legal: {
    privacyPolicy: '/privacy',
    termsOfService: '/terms',
    cookiePolicy: '/cookies',
  },
};

export default isnaBrandingConfig;
