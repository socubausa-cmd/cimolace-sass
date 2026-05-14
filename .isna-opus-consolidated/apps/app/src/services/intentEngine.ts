export type SmartIntent =
  | 'information'
  | 'pricing'
  | 'cursus'
  | 'module'
  | 'coaching'
  | 'booking'
  | 'support'
  | 'complex';

export function detectSmartIntent(message: string): SmartIntent {
  const source = String(message || '').toLowerCase();
  if (/(rendez|rdv|entretien|conseiller)/.test(source)) return 'booking';
  if (/(coaching|praticien|metier)/.test(source)) return 'coaching';
  if (/(module|libation|talisman|protection|guerison)/.test(source)) return 'module';
  if (/(cursus|fondamental|base|comprendre)/.test(source)) return 'cursus';
  if (/(prix|tarif|combien|paiement|payer)/.test(source)) return 'pricing';
  if (/(support|probleme|aide|bug)/.test(source)) return 'support';
  if (/(complexe|personnel|urgent|sensible)/.test(source)) return 'complex';
  return 'information';
}
