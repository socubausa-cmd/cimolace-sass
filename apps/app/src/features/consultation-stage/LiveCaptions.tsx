// ─────────────────────────────────────────────────────────────────────────────
// SOUS-TITRES LIVE MULTILINGUES — téléconsultation MEDOS.
//
// Le PRATICIEN (hôte) active « Sous-titres » : sa parole est transcrite en direct
// (Web Speech API, micro local, gratuit) et CHAQUE segment est diffusé sur le
// canal `med-cockpit` (event 'caption', cf. useCockpitChannel.shareCaption).
//
// Chaque PARTICIPANT (patient/invité) choisit SA langue d'écoute → le segment
// reçu est traduit LOCALEMENT (edge `translate-transcript`, déjà déployée, +
// cache mémoire) et affiché en overlay bas de scène. « Origine » = pas de
// traduction (texte source). Per-participant : chacun sa langue, indépendamment.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { Languages, Check } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useWebSpeechScribe } from '@/hooks/useWebSpeechScribe';

const GOLD = '#b08d57';

// Langues proposées (source = français ; sélection utile au tenant zahirwellness
// — contexte Afrique centrale — + langues internationales courantes).
// `code` = le NOM de langue envoyé à l'edge translate-transcript (DeepSeek
// traduit BIEN mieux avec « Lingala » qu'avec « ln » — testé : les codes ISO
// courts échouent sur les langues moins répandues). '' = pas de traduction.
const LANGS: Array<{ code: string; label: string }> = [
  { code: '', label: 'Origine (français)' },
  { code: 'English', label: 'English' },
  { code: 'Spanish', label: 'Español' },
  { code: 'Portuguese', label: 'Português' },
  { code: 'Arabic', label: 'العربية' },
  { code: 'Lingala', label: 'Lingála' },
  { code: 'Swahili', label: 'Kiswahili' },
  { code: 'Chinese', label: '中文' },
];

// Cache module (session) : évite de re-traduire le même segment × langue.
const _cache = new Map<string, string>();

async function translateLine(text: string, targetLang: string): Promise<string> {
  const key = `${targetLang}:${text}`;
  const hit = _cache.get(key);
  if (hit !== undefined) return hit;
  try {
    const { data, error } = await supabase.functions.invoke('translate-transcript', {
      body: { transcript: [{ text }], targetLang },
    });
    if (error) return text;
    const out = (data?.transcript?.[0]?.text as string) || text;
    // Borne mémoire : évince le plus ancien au-delà de 500 entrées (Map = ordre
    // d'insertion) — évite une fuite lente sur une longue consultation.
    if (_cache.size >= 500) {
      const oldest = _cache.keys().next().value;
      if (oldest !== undefined) _cache.delete(oldest);
    }
    _cache.set(key, out);
    return out;
  } catch {
    return text;
  }
}

type Channel = { caption?: { text: string; id: number } | null; shareCaption?: (t: string) => void };

// ── HÔTE : bouton pour activer/couper les sous-titres (lance le STT) ──────────
export function HostCaptionToggle({ channel }: { channel: Channel }) {
  const [on, setOn] = useState(false);
  const scribe = useWebSpeechScribe({ lang: 'fr-FR', onFinalChunk: channel.shareCaption });

  useEffect(() => {
    if (on) scribe.start(); else scribe.stop();
    return () => scribe.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  if (!scribe.supported) return null;

  return (
    <button
      type="button"
      onClick={() => setOn((v) => !v)}
      aria-pressed={on}
      title={on ? 'Couper les sous-titres live' : 'Activer les sous-titres live (traduits chez chaque participant)'}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        height: 38, padding: '0 12px', borderRadius: 9, border: 'none', cursor: 'pointer',
        background: on ? GOLD : 'rgba(255,255,255,0.1)', color: on ? '#1a1a1a' : '#fff',
        fontSize: 13, fontWeight: 600, flexShrink: 0,
      }}
    >
      <Languages size={16} aria-hidden="true" />
      {on ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          Sous-titres
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: scribe.listening ? '#ef4444' : '#1a1a1a' }} />
        </span>
      ) : 'Sous-titres'}
    </button>
  );
}

// ── PARTICIPANT : sélecteur de langue (flottant) + overlay de sous-titres ────
export function ParticipantCaptions({ channel }: { channel: Channel }) {
  const [lang, setLang] = useState('');
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState('');
  const [active, setActive] = useState(false); // au moins un sous-titre reçu → montre la commande
  const hideTimer = useRef<number | null>(null);

  // Traduit le dernier segment reçu → texte affiché.
  useEffect(() => {
    const cap = channel.caption;
    if (!cap?.text) return;
    setActive(true);
    let alive = true;
    if (!lang) {
      setShown(cap.text);
    } else {
      void translateLine(cap.text, lang).then((t) => { if (alive) setShown(t); });
    }
    return () => { alive = false; };
  }, [channel.caption, lang]);

  // Auto-masquage du sous-titre après un silence.
  useEffect(() => {
    if (!shown) return undefined;
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setShown(''), 6500);
    return () => { if (hideTimer.current) window.clearTimeout(hideTimer.current); };
  }, [shown, channel.caption?.id]);

  // Rien reçu encore → on n'affiche aucune commande (évite le bruit visuel).
  if (!active) return null;

  const current = LANGS.find((l) => l.code === lang) || LANGS[0];

  return (
    <>
      {/* Sélecteur de langue — pastille flottante bas-gauche. */}
      <div style={{ position: 'fixed', left: 14, bottom: 78, zIndex: 2147483210 }}>
        {open ? (
          <div style={{ position: 'absolute', bottom: 44, left: 0, minWidth: 180, background: 'rgba(22,22,24,0.97)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 6, boxShadow: '0 16px 44px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: 10.5, color: '#9ca3af', padding: '4px 8px 6px', fontWeight: 600 }}>Langue des sous-titres</div>
            {LANGS.map((l) => (
              <button
                key={l.code || 'src'}
                onClick={() => { setLang(l.code); setOpen(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '7px 8px', borderRadius: 8, border: 'none', cursor: 'pointer', background: l.code === lang ? 'rgba(176,141,87,0.16)' : 'transparent', color: l.code === lang ? GOLD : '#e5e7eb', fontSize: 12.5 }}
              >
                <span style={{ width: 14, display: 'inline-flex' }}>{l.code === lang ? <Check size={13} /> : null}</span>
                {l.label}
              </button>
            ))}
          </div>
        ) : null}
        <button
          onClick={() => setOpen((v) => !v)}
          title="Choisir la langue des sous-titres"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(22,22,24,0.9)', color: lang ? GOLD : '#fff', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, backdropFilter: 'blur(8px)' }}
        >
          <Languages size={15} aria-hidden="true" />
          {lang ? current.label : 'Sous-titres'}
        </button>
      </div>

      {/* Overlay de sous-titres — bas-centre, au-dessus de la barre. */}
      {shown ? (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 84, zIndex: 2147483205, maxWidth: 'min(760px, 92vw)', pointerEvents: 'none' }}>
          <div style={{ background: 'rgba(12,11,10,0.82)', color: '#fff', fontSize: 'clamp(15px, 2.4vw, 21px)', lineHeight: 1.35, fontWeight: 600, padding: '10px 16px', borderRadius: 12, textAlign: 'center', textShadow: '0 1px 3px rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
            {shown}
          </div>
        </div>
      ) : null}
    </>
  );
}
