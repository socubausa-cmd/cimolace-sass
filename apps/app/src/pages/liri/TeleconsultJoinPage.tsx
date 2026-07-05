// ─────────────────────────────────────────────────────────────────────────────
// LIEN DE GROUPE — page publique d'AUTO-INSCRIPTION à une téléconsultation.
// Route : /teleconsult/:id/rejoindre?tenant=<slug>
//
// L'hôte diffuse UN seul lien de groupe. Chaque personne saisit son nom + email →
// on crée SA propre invitation (siège unique → identité LiveKit unique → zéro
// collision/kick) → elle est renvoyée vers /teleconsult/:id/proche/:inviteId où
// elle patiente jusqu'à ce que l'hôte l'admette nominativement.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ShieldCheck, UserPlus } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/apiBase';
import { selfRegisterToSession } from '@/features/medos-cockpit/procheApi';

const BG = '#201e1b';
const GOLD = '#d4a36a';
const PANEL_BG = 'rgba(255,255,255,0.045)';
const PANEL_BORDER = '1px solid rgba(212,163,106,0.28)';
const MESH =
  'radial-gradient(1100px 600px at 50% -10%, rgba(212,163,106,0.10), transparent 60%)';

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 11,
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(0,0,0,0.25)',
  color: '#fff',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};
const labelStyle: CSSProperties = {
  display: 'block',
  textAlign: 'left',
  fontSize: 12.5,
  color: '#cbd5e1',
  fontWeight: 600,
  margin: '0 0 5px 2px',
};

export default function TeleconsultJoinPage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const slug = params.get('tenant');
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [relationship, setRelationship] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [clinicLogo, setClinicLogo] = useState<string | null>(null);
  const [clinicName, setClinicName] = useState<string | null>(null);

  // Branding public du cabinet (logo + nom) par slug.
  useEffect(() => {
    if (!slug) return undefined;
    let alive = true;
    fetch(`${getApiBaseUrl()}/tenants/by-slug/${encodeURIComponent(slug)}/branding`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        const logo = j?.data?.logo_url || j?.logo_url || null;
        const nm = j?.data?.name || j?.name || null;
        if (logo) setClinicLogo(String(logo));
        if (nm) setClinicName(String(nm));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [slug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !name.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const { invite_id } = await selfRegisterToSession(sessionId, {
        name: name.trim(),
        email: email.trim() || undefined,
        relationship: relationship.trim() || undefined,
      });
      // → salle d'attente : l'hôte admet la personne nominativement.
      navigate(
        `/teleconsult/${sessionId}/proche/${invite_id}${slug ? `?tenant=${encodeURIComponent(slug)}` : ''}`,
      );
    } catch (e2: any) {
      setErr(e2?.message || 'Inscription impossible pour le moment.');
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483000,
        background: BG,
        backgroundImage: MESH,
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        overflowY: 'auto',
      }}
    >
      <div style={{ width: '100%', maxWidth: 430 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <img
            src="/lirilogo.png"
            alt="LIRI"
            style={{ height: 38, width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 2px 10px rgba(212,163,106,0.4))' }}
          />
          {(clinicLogo || clinicName) && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '6px 13px 6px 8px', borderRadius: 999, background: PANEL_BG, border: PANEL_BORDER }}>
              {clinicLogo ? <img src={clinicLogo} alt="" style={{ height: 22, width: 'auto', maxWidth: 70, objectFit: 'contain', borderRadius: 5 }} /> : null}
              <span style={{ fontSize: 13, fontWeight: 600, color: '#f5f4ee' }}>{clinicName || 'Consultation'}</span>
            </div>
          )}
        </div>

        <form onSubmit={submit} style={{ background: PANEL_BG, border: PANEL_BORDER, borderRadius: 20, padding: 22, boxShadow: '0 30px 80px rgba(0,0,0,0.5)', textAlign: 'center' }}>
          <UserPlus size={28} color={GOLD} style={{ margin: '0 auto 8px' }} aria-hidden="true" />
          <h2 style={{ margin: '0 0 4px', fontSize: 19, color: '#fff', fontWeight: 700 }}>Rejoindre la consultation</h2>
          <p style={{ margin: '0 0 18px', fontSize: 13, color: '#cbd5e1', lineHeight: 1.5 }}>
            Indiquez votre nom pour demander à participer. Votre entrée sera autorisée par le praticien.
          </p>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle} htmlFor="jr-name">Votre nom *</label>
            <input id="jr-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom et prénom" style={inputStyle} autoFocus maxLength={80} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle} htmlFor="jr-email">Email (facultatif)</label>
            <input id="jr-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" style={inputStyle} maxLength={120} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle} htmlFor="jr-rel">Vous êtes… (facultatif)</label>
            <input id="jr-rel" value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="ex : fille, confrère, aidant" style={inputStyle} maxLength={60} />
          </div>

          {err ? (
            <p role="alert" style={{ margin: '0 0 12px', fontSize: 12.5, color: '#fca5a5', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 10, padding: '8px 10px' }}>
              {err}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy || !name.trim()}
            style={{ width: '100%', padding: '13px 22px', borderRadius: 12, border: 'none', cursor: busy || !name.trim() ? 'default' : 'pointer', background: GOLD, color: '#1a1a1a', fontSize: 15, fontWeight: 700, opacity: busy || !name.trim() ? 0.55 : 1 }}
          >
            {busy ? 'Inscription…' : 'Demander à rejoindre'}
          </button>

          <p style={{ margin: '14px 0 0', fontSize: 11.5, color: '#9a978f', display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
            <ShieldCheck size={13} color={GOLD} aria-hidden="true" /> Liaison sécurisée · propulsé par LIRI
          </p>
        </form>
      </div>
    </div>
  );
}
