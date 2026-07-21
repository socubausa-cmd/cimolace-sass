// ─────────────────────────────────────────────────────────────────────────────
// API PUBLIQUE du proche invité (sans compte tenant). Token-gatée par l'id
// d'invitation (non devinable). Pas d'en-tête d'auth → fetch nu (pas l'axios
// `api` qui injecte Authorization + X-Tenant-Slug). Le tenant est résolu
// côté serveur à partir de l'invitation.
// ─────────────────────────────────────────────────────────────────────────────
import { getApiBaseUrl } from '@/lib/apiBase';

const BASE = getApiBaseUrl();
// Le wrapper de réponse Nest enveloppe en { data: … } ; on pèle défensivement.
const peel = (j: any) => (j && j.data !== undefined ? j.data : j);

export interface ProcheStatus {
  status: 'consent_requested' | 'consented' | 'denied' | 'admitted' | 'revoked';
  display_name: string;
  session_id: string;
  clinic_name: string;
  /** Statut de la SESSION (pas de l'invite) : 'ended'/'cancelled' → la salle
   *  affiche « Consultation terminée » au lieu de poller à l'infini. */
  session_status?: string | null;
}

export async function getProcheStatus(inviteId: string): Promise<ProcheStatus> {
  const r = await fetch(`${BASE}/med/teleconsult-invite-public/${inviteId}/status`);
  if (!r.ok) throw new Error(r.status === 404 ? 'Invitation introuvable' : `Erreur ${r.status}`);
  return peel(await r.json());
}

export async function getProcheToken(
  inviteId: string,
): Promise<{ url: string; token: string; display_name: string; session_id: string }> {
  const r = await fetch(`${BASE}/med/teleconsult-invite-public/${inviteId}/token`, {
    method: 'POST',
  });
  if (!r.ok) {
    // L'API Nest enveloppe les erreurs dans { error: { message } } — lire À CET ENDROIT
    // (sinon on tombait toujours sur le fallback trompeur « autorisation du patient »).
    let serverMsg = '';
    try {
      const j = await r.json();
      serverMsg = j?.error?.message || j?.message || j?.data?.message || '';
    } catch {
      /* ignore */
    }
    // 403 alors que le patient a déjà consenti = la consultation n'a pas encore
    // DÉMARRÉ (le praticien n'est pas dans la salle) → état d'ATTENTE, pas une erreur
    // finale : la salle patiente et réessaie. Seule exception non-retryable : lien
    // déjà utilisé par un autre participant (mono-siège).
    const e = new Error(serverMsg || 'Impossible de rejoindre la consultation.') as Error & {
      notStarted?: boolean;
    };
    if (r.status === 403 && !/déjà utilisé|already/i.test(serverMsg)) {
      e.notStarted = true;
    }
    throw e;
  }
  return peel(await r.json());
}

/**
 * LIEN DE GROUPE : auto-inscription à une séance (nom + email). Crée l'invitation
 * de la personne et renvoie son `invite_id` → elle rejoint ensuite la salle
 * d'attente /proche/<invite_id> (siège unique, admise nominativement par l'hôte).
 */
export async function selfRegisterToSession(
  sessionId: string,
  body: { name: string; email?: string; relationship?: string },
): Promise<{ invite_id: string }> {
  const r = await fetch(`${BASE}/med/teleconsult-invite-public/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, ...body }),
  });
  if (!r.ok) {
    let msg = 'Inscription impossible';
    try {
      const j = await r.json();
      msg = j?.message || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return peel(await r.json());
}
