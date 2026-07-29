'use strict';
/**
 * Hook `afterSign` d'electron-builder : notarise le .app macOS via notarytool.
 *
 * ENV-GATÉ À DESSEIN. Sans les 3 identifiants Apple, le hook NE FAIT RIEN et le
 * build local continue de produire un artefact (non distribuable, mais utile pour
 * tester). Dès que le fondateur exporte APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD +
 * APPLE_TEAM_ID (et fournit un certificat « Developer ID Application » via
 * CSC_LINK/CSC_KEY_PASSWORD ou le trousseau), le même `npm run build:mac` signe,
 * notarise et agrafe le ticket — zéro secret dans le dépôt.
 */
const { notarize } = require('@electron/notarize');
const { execFileSync } = require('node:child_process');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') return;

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;
  if (!appleId || !appleIdPassword || !teamId) {
    console.log(
      '[notarize] APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID absents → ' +
        'notarisation SAUTÉE. L’artefact fonctionne mais montrera l’alerte Gatekeeper.',
    );
    return;
  }

  const appName = context.packager.appInfo.productFilename; // "LIRI"
  const appPath = `${appOutDir}/${appName}.app`;
  console.log(`[notarize] notarisation de ${appPath} (équipe ${teamId})…`);

  await notarize({ tool: 'notarytool', appPath, appleId, appleIdPassword, teamId });

  // Agrafe le ticket dans le bundle pour un lancement hors-ligne sans latence.
  try {
    execFileSync('xcrun', ['stapler', 'staple', appPath], { stdio: 'inherit' });
    console.log('[notarize] ✅ notarisé + agrafé.');
  } catch (e) {
    console.warn('[notarize] notarisé, mais l’agrafage a échoué (le ticket reste valide en ligne) :', e.message);
  }
};
