export async function sendAppointmentReminder(payload: Record<string, unknown>, token: string) {
  const res = await fetch('/.netlify/functions/booking-send-reminder', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || 'Unable to send reminder');
  return json;
}
