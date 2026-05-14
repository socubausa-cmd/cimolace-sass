export async function fetchAvailableSlots(params: {
  timezone: string;
  country?: string;
  windowStart: string;
  windowEnd: string;
}) {
  const qs = new URLSearchParams();
  qs.set('timezone', params.timezone);
  qs.set('windowStart', params.windowStart);
  qs.set('windowEnd', params.windowEnd);
  if (params.country) qs.set('country', params.country);
  const res = await fetch(`/.netlify/functions/booking-available-slots?${qs.toString()}`);
  if (!res.ok) throw new Error('Unable to load slots');
  return res.json();
}
