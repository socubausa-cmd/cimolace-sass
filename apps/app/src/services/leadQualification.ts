export type LeadTemperature = 'cold' | 'warm' | 'hot';

export function qualifyLeadFromIntent(intent: string): { temperature: LeadTemperature; recommendedOffer: string } {
  const safeIntent = String(intent || '').toLowerCase();
  if (safeIntent === 'booking' || safeIntent === 'coaching' || safeIntent === 'pricing') {
    return { temperature: 'hot', recommendedOffer: safeIntent === 'pricing' ? 'forfaits' : safeIntent };
  }
  if (safeIntent === 'module' || safeIntent === 'cursus') {
    return { temperature: 'warm', recommendedOffer: safeIntent };
  }
  return { temperature: 'cold', recommendedOffer: 'cursus' };
}
