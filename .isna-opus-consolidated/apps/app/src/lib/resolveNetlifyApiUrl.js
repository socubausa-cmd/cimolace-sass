/**
 * En développement (Vite), les redirects Netlify `from = /api/...` ne s'appliquent pas.
 * On mappe vers `/.netlify/functions/...` pour que le proxy Vite (`netlify dev` sur :8888) fonctionne.
 * En production, les URLs `/api/...` restent inchangées (redirects Netlify).
 */
const DEV_API_TO_FUNCTION = {
  '/api/marketing/leads': '/.netlify/functions/marketing-leads',
  '/api/marketing/analytics': '/.netlify/functions/marketing-analytics',
  '/api/marketing/funnels': '/.netlify/functions/marketing-funnels',
  '/api/marketing/automation/list': '/.netlify/functions/marketing-automation-list',
  '/api/marketing/automation/audit': '/.netlify/functions/marketing-automation-audit',
  '/api/marketing/automation/run': '/.netlify/functions/marketing-automation-run',
  '/api/marketing/automation/create': '/.netlify/functions/marketing-automation-create',
  '/api/marketing/automation/update': '/.netlify/functions/marketing-automation-update',
  '/api/marketing/automation/delete': '/.netlify/functions/marketing-automation-delete',
  '/api/marketing/campaigns': '/.netlify/functions/marketing-campaigns',
  '/api/marketing/campaign/create': '/.netlify/functions/marketing-campaign-create',
  '/api/marketing/campaign/start': '/.netlify/functions/marketing-campaign-start',
  '/api/marketing/funnel/create': '/.netlify/functions/marketing-funnel-create',
  '/api/marketing/lead/capture': '/.netlify/functions/marketing-lead-capture',
  '/api/marketing/publish': '/.netlify/functions/marketing-publish',
  '/api/marketing/payment/recovery': '/.netlify/functions/marketing-payment-recovery',
  '/api/marketing/logs': '/.netlify/functions/marketing-logs',
  '/api/marketing/ai/suggest-message': '/.netlify/functions/marketing-ai-suggest-message',
  '/api/marketing/score/refresh': '/.netlify/functions/marketing-score-refresh',
  '/api/marketing/orchestrate': '/.netlify/functions/marketing-orchestrate',
  '/api/response/query': '/.netlify/functions/response-engine-query',
  '/api/response/secretariat/threads': '/.netlify/functions/response-engine-secretariat-threads',
  '/api/response/secretariat/reply': '/.netlify/functions/response-engine-secretariat-reply',
  '/api/response/secretariat/messages': '/.netlify/functions/response-engine-thread-messages',
  '/api/response/followup/run': '/.netlify/functions/response-engine-followup',
  '/api/response/kb/list': '/.netlify/functions/response-kb-list',
  '/api/response/kb/upsert': '/.netlify/functions/response-kb-upsert',
  '/api/response/kb/delete': '/.netlify/functions/response-kb-delete',
  '/api/response/kb/ingest': '/.netlify/functions/response-kb-ingest',
};

export function resolveNetlifyApiUrl(url) {
  if (import.meta.env.PROD || typeof url !== 'string') return url;
  const q = url.includes('?') ? url.slice(url.indexOf('?')) : '';
  const path = q ? url.slice(0, url.indexOf('?')) : url;
  const mapped = DEV_API_TO_FUNCTION[path];
  return mapped ? `${mapped}${q}` : url;
}
