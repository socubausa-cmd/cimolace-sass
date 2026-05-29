export function shouldEscalateToHuman(params: { intent?: string; temperature?: string; message?: string }) {
  const intent = String(params.intent || '').toLowerCase();
  const temperature = String(params.temperature || '').toLowerCase();
  const msg = String(params.message || '').toLowerCase();
  if (intent === 'booking' || intent === 'coaching') return true;
  if (temperature === 'hot') return true;
  if (/(complexe|urgent|personnel|sensible)/.test(msg)) return true;
  return false;
}
