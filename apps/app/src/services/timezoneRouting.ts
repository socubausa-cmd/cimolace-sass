export type VisitorContext = {
  timezone: string;
  country?: string | null;
  region: 'AF_EU' | 'US';
};

export async function detectBookingContext(params: { timezone?: string; country?: string }) {
  const qs = new URLSearchParams();
  if (params.timezone) qs.set('timezone', params.timezone);
  if (params.country) qs.set('country', params.country);
  const res = await fetch(`/.netlify/functions/booking-detect-context?${qs.toString()}`);
  if (!res.ok) throw new Error('Unable to detect context');
  return res.json();
}
