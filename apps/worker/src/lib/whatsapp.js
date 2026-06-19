/**
 * whatsapp.js — Envoi WhatsApp via Twilio (best-effort) pour le worker.
 *
 * No-op (status 'disabled') si les identifiants Twilio sont absents → le worker
 * ne casse jamais quand WhatsApp n'est pas configuré (même garde que l'email/Resend).
 *
 * ⚠️ WhatsApp Business : un message PROACTIF (hors fenêtre de 24 h ouverte par
 * l'élève) DOIT utiliser un template approuvé. Si TWILIO_WHATSAPP_CONTENT_SID est
 * fourni, on l'utilise avec les variables {1:title, 2:when, 3:link}. Sinon on envoie
 * un corps libre (fonctionne seulement en bac à sable Twilio ou dans une session 24 h).
 *
 * Env : TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
 *       (ou TWILIO_PHONE_NUMBER), TWILIO_WHATSAPP_CONTENT_SID (optionnel).
 */
const SID = process.env.TWILIO_ACCOUNT_SID || '';
const TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const FROM = process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_PHONE_NUMBER || '';
const CONTENT_SID = process.env.TWILIO_WHATSAPP_CONTENT_SID || '';

export function whatsappConfigured() {
  return Boolean(SID && SID !== 'replace_me' && TOKEN && FROM);
}

function waAddr(n) {
  const s = String(n || '').trim();
  return s.startsWith('whatsapp:') ? s : `whatsapp:${s}`;
}

/**
 * @param {{to:string, title?:string, when?:string, link?:string}} msg
 * @returns {Promise<{status:'sent'|'failed'|'error'|'disabled', http?:number, error?:string}>}
 */
export async function sendWhatsApp({ to, title, when, link }) {
  if (!whatsappConfigured() || !to) return { status: 'disabled' };

  const body = new URLSearchParams({ To: waAddr(to), From: waAddr(FROM) });
  if (CONTENT_SID) {
    body.set('ContentSid', CONTENT_SID);
    body.set('ContentVariables', JSON.stringify({ 1: title || '', 2: when || '', 3: link || '' }));
  } else {
    const txt = `Invitation — ${title || 'Séance live'}${when ? ` le ${when}` : ''}. Rejoindre : ${link || ''}`.trim();
    body.set('Body', txt);
  }

  try {
    const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${SID}:${TOKEN}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    return { status: resp.ok ? 'sent' : 'failed', http: resp.status };
  } catch (e) {
    return { status: 'error', error: String(e) };
  }
}
