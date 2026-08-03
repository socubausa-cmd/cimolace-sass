/**
 * Envoi WhatsApp via l'API OFFICIELLE Meta WhatsApp Cloud (HTTP, sans SDK — même approche
 * que stripe-rest.util / pawapay). Best-effort : inerte tant que les identifiants ne sont pas
 * configurés côté env (Railway), donc AUCUN risque en prod avant activation.
 *
 * ⚠️ Un message « business-initiated » vers un numéro qui n'a PAS écrit au business dans les
 * dernières 24 h DOIT utiliser un GABARIT (template) approuvé par Meta. D'où l'API template ici.
 *
 * ACTIVATION (fondateur) — variables d'env à poser sur Railway (service isna-api). Mêmes noms
 * qu'AFRITRACK (`backend/src/services/whatsappService.js`) → les mêmes identifiants Meta marchent :
 *   WHATSAPP_TOKEN            = token d'accès Meta Cloud API (alias accepté : WHATSAPP_ACCESS_TOKEN)
 *   WHATSAPP_PHONE_NUMBER_ID  = ID du numéro WhatsApp Business (Meta → WhatsApp → API Setup)
 *   WHATSAPP_TEMPLATE_RDV     = nom du gabarit approuvé (ex. "rdv_notification")
 *   WHATSAPP_TEMPLATE_LANG    = code langue du gabarit (défaut "fr")
 *   WHATSAPP_API_VERSION      = optionnel (défaut "v21.0", comme afritrack)
 *
 * Gabarit à soumettre à Meta (catégorie UTILITY, langue fr), 2 variables corps {{1}} {{2}} :
 *   « Bonjour 🙏 Concernant votre rendez-vous « {{1}} » : {{2}}. — Prorascience »
 */

function waToken(): string | undefined {
  return process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
}

export function isWhatsAppConfigured(): boolean {
  return !!(waToken() && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/** Numéro → MSISDN chiffres seuls (Meta exige l'international sans + ni espaces). */
export function normalizeWaMsisdn(raw: unknown): string {
  return String(raw ?? '').replace(/\D/g, '');
}

export async function sendWhatsAppTemplate(
  to: string,
  opts: { template: string; lang?: string; bodyParams?: string[] },
): Promise<{ ok: boolean; error?: string }> {
  const token = waToken();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_API_VERSION || 'v21.0';
  if (!token || !phoneId) return { ok: false, error: 'WhatsApp non configuré (env absent)' };

  const msisdn = normalizeWaMsisdn(to);
  if (msisdn.length < 8) return { ok: false, error: 'Numéro WhatsApp invalide' };
  if (!opts.template) return { ok: false, error: 'Gabarit WhatsApp manquant' };

  const payload = {
    messaging_product: 'whatsapp',
    to: msisdn,
    type: 'template',
    template: {
      name: opts.template,
      language: { code: opts.lang || 'fr' },
      components: opts.bodyParams && opts.bodyParams.length
        ? [{ type: 'body', parameters: opts.bodyParams.map((t) => ({ type: 'text', text: String(t ?? '') })) }]
        : [],
    },
  };

  try {
    const res = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status} ${t.slice(0, 240)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
