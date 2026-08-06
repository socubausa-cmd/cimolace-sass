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

/**
 * Résout un numéro SAISI (formulaire public) en MSISDN international pour Meta, SANS jamais
 * deviner un indicatif au hasard — envoyer à un mauvais préfixe = écrire à un INCONNU. Règles :
 *   - « +33… » ou « 0033… » → international explicite (on retire +/00)
 *   - « 0X… » (local)       → on préfixe l'indicatif du tenant (`defaultCc`, ex. Gabon 241)
 *   - déjà « <defaultCc>… »  → conservé tel quel
 *   - sinon (ex. « 4385319012 » sans préfixe : indicatif indevinable) → null → ON N'ENVOIE PAS
 * Renvoie null aussi si la longueur finale n'est pas plausible (10–15 chiffres) → l'e-mail
 * reste alors le seul canal (best-effort, jamais de faux destinataire).
 */
export function resolveWaMsisdn(
  raw: unknown,
  defaultCc: string = process.env.WHATSAPP_DEFAULT_CC || '241',
): string | null {
  const s = String(raw ?? '').trim();
  const digits = s.replace(/\D/g, '');
  if (!digits) return null;
  let msisdn: string | null = null;
  if (s.startsWith('+')) msisdn = digits;
  else if (digits.startsWith('00')) msisdn = digits.slice(2);
  // Local commençant par 0 → indicatif du tenant. ⚠️ Le Gabon (241) CONSERVE le 0 dans le
  // format international : « +241 06 86 33 36 » = MSISDN 24106863336 (confirmé par le wa_id qui
  // livre). On NE retire donc PAS le 0. (Règle du plan gabonais ; à revoir si defaultCc change.)
  else if (digits.startsWith('0')) msisdn = defaultCc + digits;
  else if (digits.startsWith(defaultCc)) msisdn = digits;
  else return null; // ni préfixe international, ni local avec 0, ni indicatif par défaut → ambigu
  if (msisdn.length < 10 || msisdn.length > 15) return null;
  return msisdn;
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
