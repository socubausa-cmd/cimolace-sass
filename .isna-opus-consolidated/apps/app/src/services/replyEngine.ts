export async function sendSmartResponseMessage(payload: {
  threadId?: string;
  message: string;
  visitorName?: string;
  visitorEmail?: string;
  visitorCountry?: string;
  visitorTimezone?: string;
}) {
  const res = await fetch('/api/response/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || 'Smart response error');
  return json;
}
