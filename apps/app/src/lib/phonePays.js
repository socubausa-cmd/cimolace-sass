/**
 * Indicatifs téléphoniques par pays pour la prise de rendez-vous : le visiteur choisit
 * son pays, l'indicatif est IMPOSÉ, il ne saisit que son numéro local. On valide la
 * longueur nationale attendue avant d'accepter, et on soumet toujours l'international
 * complet (« +241066863336 ») — plus jamais de numéro ambigu côté secrétariat.
 *
 * `min`/`max` = nombre de chiffres du numéro LOCAL attendu (après nettoyage).
 * `garde0` = le 0 initial fait PARTIE du numéro international (cas du Gabon :
 * « +241 06 86 33 36 » → 24106863336, confirmé par les wa_id qui livrent). Partout
 * ailleurs le 0 de tête est un préfixe national qu'on retire (France 06… → +33 6…).
 */

export const PAYS_TEL = [
  { iso: 'GA', nom: 'Gabon', drapeau: '🇬🇦', cc: '241', min: 8, max: 9, garde0: true },
  { iso: 'CM', nom: 'Cameroun', drapeau: '🇨🇲', cc: '237', min: 9, max: 9 },
  { iso: 'FR', nom: 'France', drapeau: '🇫🇷', cc: '33', min: 9, max: 9 },
  { iso: 'CD', nom: 'RD Congo', drapeau: '🇨🇩', cc: '243', min: 9, max: 9 },
  { iso: 'CG', nom: 'Congo', drapeau: '🇨🇬', cc: '242', min: 9, max: 9 },
  { iso: 'CI', nom: 'Côte d’Ivoire', drapeau: '🇨🇮', cc: '225', min: 10, max: 10 },
  { iso: 'SN', nom: 'Sénégal', drapeau: '🇸🇳', cc: '221', min: 9, max: 9 },
  { iso: 'BJ', nom: 'Bénin', drapeau: '🇧🇯', cc: '229', min: 8, max: 10 },
  { iso: 'TG', nom: 'Togo', drapeau: '🇹🇬', cc: '228', min: 8, max: 8 },
  { iso: 'BF', nom: 'Burkina Faso', drapeau: '🇧🇫', cc: '226', min: 8, max: 8 },
  { iso: 'ML', nom: 'Mali', drapeau: '🇲🇱', cc: '223', min: 8, max: 8 },
  { iso: 'GN', nom: 'Guinée', drapeau: '🇬🇳', cc: '224', min: 9, max: 9 },
  { iso: 'GQ', nom: 'Guinée équatoriale', drapeau: '🇬🇶', cc: '240', min: 9, max: 9 },
  { iso: 'TD', nom: 'Tchad', drapeau: '🇹🇩', cc: '235', min: 8, max: 8 },
  { iso: 'CF', nom: 'Centrafrique', drapeau: '🇨🇫', cc: '236', min: 8, max: 8 },
  { iso: 'NE', nom: 'Niger', drapeau: '🇳🇪', cc: '227', min: 8, max: 8 },
  { iso: 'NG', nom: 'Nigéria', drapeau: '🇳🇬', cc: '234', min: 10, max: 10 },
  { iso: 'GH', nom: 'Ghana', drapeau: '🇬🇭', cc: '233', min: 9, max: 9 },
  { iso: 'RW', nom: 'Rwanda', drapeau: '🇷🇼', cc: '250', min: 9, max: 9 },
  { iso: 'BI', nom: 'Burundi', drapeau: '🇧🇮', cc: '257', min: 8, max: 8 },
  { iso: 'KE', nom: 'Kenya', drapeau: '🇰🇪', cc: '254', min: 9, max: 9 },
  { iso: 'AO', nom: 'Angola', drapeau: '🇦🇴', cc: '244', min: 9, max: 9 },
  { iso: 'ZA', nom: 'Afrique du Sud', drapeau: '🇿🇦', cc: '27', min: 9, max: 9 },
  { iso: 'MG', nom: 'Madagascar', drapeau: '🇲🇬', cc: '261', min: 9, max: 9 },
  { iso: 'MA', nom: 'Maroc', drapeau: '🇲🇦', cc: '212', min: 9, max: 9 },
  { iso: 'DZ', nom: 'Algérie', drapeau: '🇩🇿', cc: '213', min: 9, max: 9 },
  { iso: 'TN', nom: 'Tunisie', drapeau: '🇹🇳', cc: '216', min: 8, max: 8 },
  { iso: 'HT', nom: 'Haïti', drapeau: '🇭🇹', cc: '509', min: 8, max: 8 },
  { iso: 'BE', nom: 'Belgique', drapeau: '🇧🇪', cc: '32', min: 8, max: 9 },
  { iso: 'CH', nom: 'Suisse', drapeau: '🇨🇭', cc: '41', min: 9, max: 9 },
  { iso: 'LU', nom: 'Luxembourg', drapeau: '🇱🇺', cc: '352', min: 6, max: 9 },
  { iso: 'GB', nom: 'Royaume-Uni', drapeau: '🇬🇧', cc: '44', min: 10, max: 10 },
  { iso: 'DE', nom: 'Allemagne', drapeau: '🇩🇪', cc: '49', min: 10, max: 11 },
  { iso: 'IT', nom: 'Italie', drapeau: '🇮🇹', cc: '39', min: 9, max: 11, garde0: true },
  { iso: 'ES', nom: 'Espagne', drapeau: '🇪🇸', cc: '34', min: 9, max: 9 },
  { iso: 'PT', nom: 'Portugal', drapeau: '🇵🇹', cc: '351', min: 9, max: 9 },
  { iso: 'NL', nom: 'Pays-Bas', drapeau: '🇳🇱', cc: '31', min: 9, max: 9 },
  { iso: 'CA', nom: 'Canada', drapeau: '🇨🇦', cc: '1', min: 10, max: 10 },
  { iso: 'US', nom: 'États-Unis', drapeau: '🇺🇸', cc: '1', min: 10, max: 10 },
  { iso: 'BR', nom: 'Brésil', drapeau: '🇧🇷', cc: '55', min: 10, max: 11 },
];

/** Option de secours quand le pays n'est pas listé : saisie internationale libre (+…). */
export const PAYS_AUTRE = { iso: 'XX', nom: 'Autre pays', drapeau: '🌍', cc: '', min: 8, max: 15 };

export const PAYS_PAR_DEFAUT = 'GA';

export function trouverPays(iso) {
  if (iso === PAYS_AUTRE.iso) return PAYS_AUTRE;
  return PAYS_TEL.find((p) => p.iso === iso) || null;
}

/**
 * Nettoie une saisie de numéro LOCAL pour un pays donné : ne garde que les chiffres,
 * absorbe un indicatif collé par erreur (« +241… », « 00241… », « 241… » si trop long),
 * et retire le 0 de tête là où il n'est qu'un préfixe national (sauf `garde0`).
 */
export function nettoyerLocal(pays, saisie) {
  const brut = String(saisie ?? '').trim();
  let chiffres = brut.replace(/\D/g, '');
  if (!pays || pays.iso === PAYS_AUTRE.iso) return chiffres;
  // Indicatif recollé par le visiteur (copier-coller d'un numéro international).
  if (brut.startsWith('+') && chiffres.startsWith(pays.cc)) chiffres = chiffres.slice(pays.cc.length);
  else if (chiffres.startsWith('00' + pays.cc)) chiffres = chiffres.slice(2 + pays.cc.length);
  else if (chiffres.startsWith(pays.cc) && chiffres.length > pays.max) chiffres = chiffres.slice(pays.cc.length);
  if (!pays.garde0) chiffres = chiffres.replace(/^0+/, '');
  return chiffres;
}

/** Valide un numéro local nettoyé. Renvoie { ok, message } — message = aide, pas un reproche. */
export function validerLocal(pays, local) {
  const n = String(local || '').length;
  if (!pays) return { ok: false, message: 'Choisissez votre pays.' };
  if (n === 0) return { ok: false, message: '' };
  if (pays.iso === PAYS_AUTRE.iso) {
    if (n < pays.min) return { ok: false, message: `Numéro international trop court (au moins ${pays.min} chiffres, indicatif compris).` };
    if (n > pays.max) return { ok: false, message: `Numéro trop long (au plus ${pays.max} chiffres).` };
    return { ok: true, message: '' };
  }
  const attendu = pays.min === pays.max ? `${pays.min} chiffres` : `${pays.min} à ${pays.max} chiffres`;
  if (n < pays.min) return { ok: false, message: `${pays.nom} : ${attendu} attendus — encore ${pays.min - n}.` };
  if (n > pays.max) return { ok: false, message: `${pays.nom} : ${attendu} attendus — ${n - pays.max} de trop.` };
  return { ok: true, message: '' };
}

/** Compose l'international complet « +<indicatif><local> » (ou « +<local> » pour Autre pays). */
export function composerE164(pays, local) {
  const chiffres = String(local || '').replace(/\D/g, '');
  if (!chiffres) return '';
  if (!pays || pays.iso === PAYS_AUTRE.iso) return `+${chiffres}`;
  return `+${pays.cc}${chiffres}`;
}
