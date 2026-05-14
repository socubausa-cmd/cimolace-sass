export async function requestAppointment(payload: Record<string, unknown>, token: string) {
  const res = await fetch('/.netlify/functions/booking-request-appointment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || 'Unable to request appointment');
  return json;
}
