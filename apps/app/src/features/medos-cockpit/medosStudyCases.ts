// ─────────────────────────────────────────────────────────────────────────────
// medosStudyCases — CAS D'ÉTUDE ANONYMISÉS pour le mode « Live santé / éducation ».
//
// 100 % FICTIF : aucun patient réel, aucune donnée identifiante → zéro enjeu RGPD.
// Sert à ILLUSTRER un cas clinique type devant un groupe (jumeau 3D scoré + roue +
// SOAP + bilans). Le praticien charge un cas dans le cockpit et le partage au live ;
// tout est rendu par les vues existantes (TwinView / WheelView / SoapView / LabsView),
// via des `CockpitScene` self-contained.
//
// Les scores d'organes s'appliquent par CORRESPONDANCE DE NOM (name_fr) sur le
// jumeau anatomique générique — pas besoin de connaître les codes internes.
// ─────────────────────────────────────────────────────────────────────────────
import type { OrganColor, OrganNode, SoapNote, LabResult, WheelDomain } from './cockpit-api';

/** Score fictif appliqué à un organe dont le `name_fr` contient `match` (insensible casse). */
export interface CaseOrganScore {
  match: string;
  score: number;
  color: OrganColor;
}

export interface MedosStudyCase {
  id: string;
  title: string;
  summary: string;
  sex: 'female' | 'male';
  organScores: CaseOrganScore[];
  wheel: WheelDomain[];
  soap: SoapNote;
  labs: LabResult[];
}

/** Applique les scores fictifs d'un cas au jumeau anatomique générique (par nom). */
export function applyCaseOrganScores(
  genericOrgans: OrganNode[],
  scores: CaseOrganScore[],
): OrganNode[] {
  if (!scores?.length) return genericOrgans;
  return genericOrgans.map((o) => {
    const name = (o.name_fr || '').toLowerCase();
    const hit = scores.find((s) => name.includes(s.match.toLowerCase()));
    return hit ? { ...o, score: { score: hit.score, color: hit.color } } : o;
  });
}

export const MEDOS_STUDY_CASES: MedosStudyCase[] = [
  {
    id: 'hepato-digestif',
    title: 'Surcharge hépato-digestive',
    summary: 'Terrain de fatigue + digestion lente — axe foie / intestin.',
    sex: 'female',
    organScores: [
      { match: 'foie', score: 42, color: 'orange' },
      { match: 'intestin', score: 55, color: 'yellow' },
      { match: 'estomac', score: 60, color: 'yellow' },
      { match: 'pancr', score: 68, color: 'yellow' },
    ],
    wheel: [
      { domain: 'digestion', score: 38 },
      { domain: 'energy', score: 45 },
      { domain: 'inflammation', score: 40 },
      { domain: 'sleep', score: 62 },
      { domain: 'stress', score: 55 },
      { domain: 'metabolism', score: 58 },
    ],
    soap: {
      subjective:
        'Ballonnements post-prandiaux, transit lent, fatigue en après-midi. Terrain de stress chronique. (Cas d’étude anonymisé — données fictives.)',
      objective:
        'Langue chargée, sensibilité hypochondre droit. IMC 24. Pas de signe d’alarme.',
      assessment:
        'Surcharge hépato-digestive fonctionnelle avec dysbiose probable. Pas de pathologie organique.',
      plan:
        'Hygiène alimentaire (réduction sucres rapides), drainage hépatique doux, probiotiques 4 sem., réévaluation à 1 mois.',
    },
    labs: [
      { test_name: 'ALAT', value_numeric: 48, unit: 'UI/L', reference_low: 5, reference_high: 35, flag: 'H' },
      { test_name: 'Gamma-GT', value_numeric: 62, unit: 'UI/L', reference_low: 10, reference_high: 45, flag: 'H' },
      { test_name: 'CRP', value_numeric: 4.2, unit: 'mg/L', reference_low: 0, reference_high: 5, flag: null },
      { test_name: 'Glycémie à jeun', value_numeric: 0.98, unit: 'g/L', reference_low: 0.7, reference_high: 1.1, flag: null },
    ],
  },
  {
    id: 'fatigue-martiale',
    title: 'Fatigue & carence martiale',
    summary: 'Asthénie, essoufflement — axe sang / énergie.',
    sex: 'female',
    organScores: [
      { match: 'rate', score: 50, color: 'yellow' },
      { match: 'moelle', score: 48, color: 'orange' },
      { match: 'cœur', score: 70, color: 'yellow' },
    ],
    wheel: [
      { domain: 'energy', score: 32 },
      { domain: 'immunity', score: 52 },
      { domain: 'cognition', score: 58 },
      { domain: 'sleep', score: 60 },
      { domain: 'physical_activity', score: 40 },
    ],
    soap: {
      subjective:
        'Fatigue persistante, essoufflement à l’effort, pâleur. Règles abondantes. (Cas d’étude anonymisé — données fictives.)',
      objective: 'Pâleur conjonctivale, tachycardie légère au repos. TA 110/70.',
      assessment: 'Anémie ferriprive probable sur pertes menstruelles. À confirmer biologiquement.',
      plan: 'Supplémentation martiale, apports alimentaires en fer, contrôle NFS + ferritine à 6 semaines.',
    },
    labs: [
      { test_name: 'Hémoglobine', value_numeric: 10.4, unit: 'g/dL', reference_low: 12, reference_high: 16, flag: 'L' },
      { test_name: 'Ferritine', value_numeric: 8, unit: 'µg/L', reference_low: 15, reference_high: 150, flag: 'L' },
      { test_name: 'VGM', value_numeric: 74, unit: 'fL', reference_low: 80, reference_high: 100, flag: 'L' },
    ],
  },
  {
    id: 'stress-sommeil',
    title: 'Stress chronique & sommeil',
    summary: 'Axe nerveux / hormonal — troubles du sommeil.',
    sex: 'male',
    organScores: [
      { match: 'surr', score: 45, color: 'orange' },
      { match: 'thyro', score: 62, color: 'yellow' },
      { match: 'cerv', score: 66, color: 'yellow' },
    ],
    wheel: [
      { domain: 'stress', score: 30 },
      { domain: 'sleep', score: 35 },
      { domain: 'hormones', score: 48 },
      { domain: 'emotions', score: 42 },
      { domain: 'energy', score: 50 },
    ],
    soap: {
      subjective:
        'Réveils nocturnes, ruminations, irritabilité, charge de travail élevée. (Cas d’étude anonymisé — données fictives.)',
      objective: 'Tension musculaire cervicale, pas de signe dépressif majeur.',
      assessment: 'Stress chronique avec dette de sommeil et hyper-sollicitation surrénalienne fonctionnelle.',
      plan: 'Cohérence cardiaque, hygiène de sommeil, adaptogènes, réévaluation du rythme de travail.',
    },
    labs: [
      { test_name: 'Cortisol (matin)', value_numeric: 22, unit: 'µg/dL', reference_low: 6, reference_high: 19, flag: 'H' },
      { test_name: 'TSH', value_numeric: 2.1, unit: 'mUI/L', reference_low: 0.4, reference_high: 4, flag: null },
      { test_name: 'Magnésium', value_numeric: 1.6, unit: 'mg/dL', reference_low: 1.7, reference_high: 2.4, flag: 'L' },
    ],
  },
];
