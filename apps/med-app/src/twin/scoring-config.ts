// Grille de scoring de la roue, éditable en back-office (praticien).
// Persistée en localStorage (par appareil) — pas de changement backend.
// Une question non présente dans l'override garde les poids/axes par défaut
// (cf. SCORING dans transformation.ts).
import type { ScoringOverride } from './transformation';

const KEY = 'medos_scoring_config';

export function loadScoringConfig(): ScoringOverride {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ScoringOverride) : {};
  } catch {
    return {};
  }
}

export function saveScoringConfig(override: ScoringOverride): void {
  try { localStorage.setItem(KEY, JSON.stringify(override)); } catch { /* noop */ }
}

export function resetScoringConfig(): void {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}
