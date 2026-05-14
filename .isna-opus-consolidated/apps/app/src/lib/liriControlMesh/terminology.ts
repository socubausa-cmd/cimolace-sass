/**
 * Terminologie produit — libellés EN (référence) + FR (interface).
 * LIRI Control Mesh · JoyKit · Split SmartBoard
 */

export const PRODUCT_NAMES = {
  controlMesh: 'LIRI Control Mesh',
  joyKit: 'JoyKit',
  splitSmartboard: 'Split SmartBoard',
  dualCanvas: 'Dual Canvas Mode',
} as const;

/** Demandes (participant → hôte). */
export const REQUEST_LABELS = {
  requestControl: { en: 'Request Control', fr: 'Demander le contrôle' },
  requestSceneAccess: { en: 'Request Scene Access', fr: 'Demander une scène' },
  requestJoyKit: { en: 'Request JoyKit', fr: 'Demander JoyKit' },
  requestMediaLane: { en: 'Request Media Lane', fr: 'Demander la piste média' },
} as const;

/** Transferts (hôte → participant). */
export const TRANSFER_LABELS = {
  passControl: { en: 'Pass Control', fr: 'Transmettre le contrôle' },
  transferJoyKit: { en: 'Transfer JoyKit', fr: 'Transmettre JoyKit' },
  assignSceneControl: { en: 'Assign Scene Control', fr: 'Attribuer la scène' },
  grantMediaControl: { en: 'Grant Media Control', fr: 'Attribuer les médias' },
} as const;

/** Co-contrôle. */
export const SHARED_CONTROL_LABELS = {
  splitControl: { en: 'Split Control', fr: 'Contrôle partagé' },
  coControlMode: { en: 'Co-Control Mode', fr: 'Co-contrôle' },
  dualSceneMode: { en: 'Dual Scene Mode', fr: 'Mode double scène' },
} as const;
