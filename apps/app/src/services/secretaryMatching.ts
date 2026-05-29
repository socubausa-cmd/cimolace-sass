export async function fetchAvailableSecretaries(params: {
  timezone: string;
  country?: string;
  when?: string;
}) {
  const qs = new URLSearchParams();
  qs.set('timezone', params.timezone);
  if (params.country) qs.set('country', params.country);
  if (params.when) qs.set('when', params.when);
  const res = await fetch(`/.netlify/functions/booking-available-secretaries?${qs.toString()}`);
  if (!res.ok) throw new Error('Unable to load secretaries');
  return res.json();
}
