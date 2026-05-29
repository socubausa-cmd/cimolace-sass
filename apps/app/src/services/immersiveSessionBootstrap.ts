export async function startImmersiveChat(appointmentId: string, token: string) {
  const res = await fetch('/.netlify/functions/booking-start-immersive-chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ appointmentId }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || 'Unable to start immersive chat');
  return json;
}

export async function startImmersiveLive(appointmentId: string, token: string) {
  const res = await fetch('/.netlify/functions/booking-start-immersive-live', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ appointmentId }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || 'Unable to start immersive live');
  return json;
}
