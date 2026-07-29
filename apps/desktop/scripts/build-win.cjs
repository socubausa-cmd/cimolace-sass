'use strict';
/**
 * Build Windows + signature Azure Trusted Signing — ENV-GATÉ (aucun secret au dépôt).
 *
 * Sans les coordonnées du compte Azure, produit un build Windows NON signé (identique
 * à `npm run build:win`). Dès que les 3 variables du compte sont posées, le même build
 * signe via Azure Trusted Signing (pas de certificat .pfx à stocker).
 *
 *   Coordonnées du compte (NON secrètes) :
 *     AZURE_TS_ENDPOINT       ex: https://weu.codesigning.azure.net/  (région du compte)
 *     AZURE_TS_ACCOUNT        nom du compte Trusted Signing
 *     AZURE_TS_CERT_PROFILE   nom du profil de certificat
 *     WIN_PUBLISHER_NAME      (optionnel) CN du certificat, ex: "Cimolace"
 *
 *   Authentification Entra (SECRÈTE — EnvironmentCredential Azure) :
 *     AZURE_TENANT_ID + AZURE_CLIENT_ID + AZURE_CLIENT_SECRET
 *     (ou AZURE_CLIENT_CERTIFICATE_PATH, cf. doc Azure EnvironmentCredential)
 *
 * ⚠️ La signature Azure Trusted Signing passe par PowerShell + le module `TrustedSigning`
 *    + signtool → elle s'exécute SOUS WINDOWS (poste ou runner CI), pas depuis macOS.
 *    Depuis un Mac, ce script produit donc le binaire NON signé ; signer sur Windows/CI.
 */
const builder = require('electron-builder');

const endpoint = process.env.AZURE_TS_ENDPOINT;
const account = process.env.AZURE_TS_ACCOUNT;
const profile = process.env.AZURE_TS_CERT_PROFILE;
const publisher = process.env.WIN_PUBLISHER_NAME;

const config = {};
if (endpoint && account && profile) {
  config.win = {
    azureSignOptions: {
      endpoint,
      codeSigningAccountName: account,
      certificateProfileName: profile,
    },
  };
  if (publisher) config.win.publisherName = publisher;
  console.log(`[build-win] Azure Trusted Signing ACTIVÉ (compte « ${account} » · profil « ${profile} »).`);
  if (process.platform !== 'win32') {
    console.warn('[build-win] ⚠️ non-Windows détecté : la signature Azure exige PowerShell + TrustedSigning (Windows/CI). Le build risque de rester non signé.');
  }
} else {
  console.log('[build-win] AZURE_TS_ENDPOINT / AZURE_TS_ACCOUNT / AZURE_TS_CERT_PROFILE absents → build Windows NON signé.');
}

builder
  .build({ targets: builder.Platform.WINDOWS.createTarget(), config })
  .then((res) => console.log('[build-win] ✅ artefacts :', res.join(', ')))
  .catch((e) => { console.error('[build-win] ÉCHEC :', (e && e.message) || e); process.exit(1); });
