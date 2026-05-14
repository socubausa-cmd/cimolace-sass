import packageJson from '../../package.json';

/**
 * Métadonnées build / runtime pour les écrans « Version » (web + LIRI élève).
 * @returns {{ packageName: string, packageVersion: string, mode: string, baseUrl: string, isDev: boolean, appName?: string }}
 */
export function getAppBuildInfo() {
  return {
    packageName: String(packageJson.name || ''),
    packageVersion: String(packageJson.version || ''),
    mode: import.meta.env.MODE,
    baseUrl: import.meta.env.BASE_URL,
    isDev: import.meta.env.DEV,
    appName: import.meta.env.VITE_APP_NAME,
  };
}
