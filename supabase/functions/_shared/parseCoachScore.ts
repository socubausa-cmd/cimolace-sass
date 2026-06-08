/**
 * Extrait le score coach LIRI (ligne finale __SCORE__: 0–100) et nettoie le texte affiché.
 */
export function parseCoachScoreBlock(text: string): {
  cleanAnalysis: string;
  score: number | null;
} {
  const raw = (text || '').trim();
  if (!raw) return { cleanAnalysis: '', score: null };

  const re = /(?:^|\n)__SCORE__:\s*(\d{1,3})\s*$/i;
  const m = raw.match(re);
  if (!m) {
    const anywhere = raw.match(/__SCORE__:\s*(\d{1,3})/i);
    if (!anywhere) return { cleanAnalysis: raw, score: null };
    const n = clampScore(parseInt(anywhere[1], 10));
    const clean = raw.replace(/\n?__SCORE__:\s*\d{1,3}\s*/gi, '\n').trim();
    return { cleanAnalysis: clean, score: n };
  }
  const n = clampScore(parseInt(m[1], 10));
  const clean = raw.replace(re, '').trim();
  return { cleanAnalysis: clean, score: n };
}

function clampScore(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

/** Seuils J4 : score élevé = slide déjà solide → intervention légère ; score bas → refonte forte. */
export type ArchitectTier = 'light' | 'medium' | 'deep' | 'full';

export function coachTierFromScore(score: number): ArchitectTier {
  if (score >= 80) return 'light';
  if (score >= 50) return 'medium';
  if (score >= 30) return 'deep';
  return 'full';
}

export function architectTokenBudget(tier: ArchitectTier): { max_tokens: number; temperature: number } {
  switch (tier) {
    case 'light':
      return { max_tokens: 1800, temperature: 0.34 };
    case 'medium':
      return { max_tokens: 2600, temperature: 0.4 };
    case 'deep':
      return { max_tokens: 3400, temperature: 0.48 };
    case 'full':
    default:
      return { max_tokens: 4096, temperature: 0.52 };
  }
}
