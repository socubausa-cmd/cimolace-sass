/**
 * CimolaceCreationAgent — assistant conversationnel immersif de création d'organisation.
 * Route (preview) : /creer-organisation/agent
 *
 * LOT 1 (cette version) : coque immersive + présence 5 états + saisie « parler à la présence ».
 *   - Fond LIRI #262624, zéro bordure, écran vide.
 *   - Présence centrale animée à 5 états (connexion / attente / réflexion / écriture / prêt).
 *   - Saisie « parler à la présence » : toucher l'écran vide OU taper (type-anywhere) fait
 *     apparaître le champ ; Entrée l'efface (retour au vide). Pas de barre fixe.
 *   - Contenu encore statique (réponses préécrites). Le vrai « cerveau » IA arrive au LOT 3
 *     (edge agent-brain : routeur d'intention + réponses + hooks + couverture).
 *
 * Cf. mémoire projet `cimolace-creation-agent-immersif` pour la direction complète (L1→L5).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { GraduationCap, Stethoscope, ShoppingBag, ArrowUp, Check } from 'lucide-react';

const BG = '#262624';
const BG_THINK = '#20232a';
const INK = '#f4efe6';
const SERIF = "'Fraunces','Source Serif 4',Georgia,serif";

// État de la présence : connexion | attente | reflexion | ecriture | pret
const GREETING = "Bonjour. Dites-moi ce que vous voulez lancer — je m'occupe du reste.";

const SUGG = [
  { kind: 'school', label: 'École / cours en ligne', Icon: GraduationCap },
  { kind: 'medos', label: 'Clinique / santé', Icon: Stethoscope },
  { kind: 'shop', label: 'Boutique en ligne', Icon: ShoppingBag },
];

const PRODUCT_REPLY = {
  school: "Parfait — pour ça, LIRI École : lives, cours, smartboard IA, replay. On construit votre espace ?",
  medos: "Pour une clinique, c'est MedOS : dossiers, notes SOAP, téléconsultation, RGPD. On le met en place ?",
  shop: "Pour vendre en ligne, Virtuel Mbolo : catalogue, panier, mobile money. On lance votre boutique ?",
};

function replyFor(v) {
  const s = v.toLowerCase();
  if (/prix|tarif|combien|co[uû]t|cher|payer/.test(s))
    return "Tout est inclus dès 150 €/mois — installation 500 € une fois, zéro commission sur vos ventes.";
  if (/zoom|concurr|pourquoi|diff[ée]r|mieux/.test(s))
    return "Zoom vous loue une salle. LIRI vous donne l'école entière — à votre marque, pas la leur.";
  return "Bien reçu. Ici, la présence vous écoute ; le cerveau qui compose la vraie réponse arrive au prochain lot.";
}

const STYLE = `
@keyframes ccaBreath{0%,100%{transform:translate(-50%,-50%) scale(1);opacity:.6}50%{transform:translate(-50%,-50%) scale(1.18);opacity:.95}}
@keyframes ccaLine{0%{background-position:-90px 0}100%{background-position:130px 0}}
@keyframes ccaEq{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}
@keyframes ccaBoot{0%{transform:translate(-50%,-50%) scale(.4);opacity:.8}100%{transform:translate(-50%,-50%) scale(1.5);opacity:0}}
@keyframes ccaHalo{0%,100%{transform:translate(-50%,-50%) scale(1);opacity:.5}50%{transform:translate(-50%,-50%) scale(1.1);opacity:.85}}
@keyframes ccaFade{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:translateY(0)}}
@keyframes ccaPing{0%{transform:scale(1);opacity:.6}100%{transform:scale(2.4);opacity:0}}
.cca-form{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);opacity:0;transition:opacity .5s ease}
.cca-dot{width:40px;height:40px;border-radius:50%;background:radial-gradient(circle,rgba(217,119,87,.82),rgba(217,119,87,.05) 70%)}
.cca-line{width:96px;height:3px;border-radius:3px;background:linear-gradient(90deg,transparent,#d97757,#e6cc92,transparent);background-size:90px 100%}
.cca-wave{display:flex;gap:4px;height:26px;align-items:center}
.cca-wave i{width:3px;height:26px;border-radius:2px;background:#d97757;display:block;transform-origin:center;animation:ccaEq .62s ease-in-out infinite}
.cca-boot{width:44px;height:44px;border-radius:50%;border:1.5px solid rgba(217,119,87,.8)}
.cca-done{display:flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:50%;background:radial-gradient(circle,rgba(63,191,106,.28),transparent 70%);color:#7fe0a0}
.cca-glow{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:320px;height:320px;border-radius:50%;background:radial-gradient(circle,rgba(217,119,87,.15),transparent 60%);transition:background .7s ease;pointer-events:none}
/* Les animations ne tournent QUE dans l'état actif (sinon leurs keyframes d'opacité écrasent le masquage → formes empilées). */
.cca-connexion .cca-boot{opacity:1;animation:ccaBoot 1.4s ease-out infinite}
.cca-attente .cca-dot{opacity:1;animation:ccaBreath 3s ease-in-out infinite}
.cca-reflexion .cca-line{opacity:1;animation:ccaLine 2s linear infinite}
.cca-reflexion .cca-glow{background:radial-gradient(circle,rgba(230,204,146,.18),transparent 60%)}
.cca-ecriture .cca-wave{opacity:1}
.cca-pret .cca-done{opacity:1;animation:ccaHalo 2.6s ease-in-out infinite}
.cca-pret .cca-glow{background:radial-gradient(circle,rgba(63,191,106,.16),transparent 60%)}
.cca-in{animation:ccaFade .5s cubic-bezier(.22,1,.36,1) both}
.cca-chip{transition:background .16s ease;cursor:pointer}
.cca-chip:hover{background:rgba(230,204,146,.14)!important}
`;

export default function CimolaceCreationAgent() {
  const [state, setState] = useState('connexion');
  const [message, setMessage] = useState('');
  const [inputOpen, setInputOpen] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef(null);
  const typeTimer = useRef(null);
  const rootRef = useRef(null);

  const speak = useCallback((text, done) => {
    setState('ecriture');
    setMessage('');
    let i = 0;
    clearInterval(typeTimer.current);
    typeTimer.current = setInterval(() => {
      i += 1;
      setMessage(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(typeTimer.current);
        setState('attente');
        if (done) done();
      }
    }, 22);
  }, []);

  // Éveil : connexion → parole du message d'accueil → attente
  useEffect(() => {
    const t = setTimeout(() => speak(GREETING), 900);
    return () => {
      clearTimeout(t);
      clearInterval(typeTimer.current);
    };
  }, [speak]);

  const openInput = useCallback((prefill = '') => {
    setInputOpen(true);
    setValue(prefill);
    setTimeout(() => inputRef.current?.focus(), 30);
  }, []);

  const closeInput = useCallback(() => {
    setInputOpen(false);
    setValue('');
  }, []);

  // « type-anywhere » : dès qu'on tape une lettre, le champ se matérialise
  useEffect(() => {
    const onKey = (e) => {
      if (inputOpen) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key && e.key.length === 1) openInput(e.key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inputOpen, openInput]);

  const submit = useCallback(() => {
    const v = value.trim();
    closeInput();
    if (!v) return;
    setState('reflexion');
    setTimeout(() => speak(replyFor(v)), 1100);
  }, [value, closeInput, speak]);

  const pick = useCallback((kind) => {
    setState('reflexion');
    setTimeout(() => speak(PRODUCT_REPLY[kind]), 1000);
  }, [speak]);

  const onRootClick = (e) => {
    if (inputOpen) return;
    if (rootRef.current && e.target === rootRef.current) openInput();
  };

  const bg = state === 'reflexion' ? BG_THINK : BG;

  return (
    <div
      ref={rootRef}
      onClick={onRootClick}
      style={{
        minHeight: '100vh',
        background: bg,
        transition: 'background .8s ease',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        padding: '0 24px',
        fontFamily: "'Inter', system-ui, sans-serif",
        cursor: inputOpen ? 'default' : 'text',
      }}
    >
      <style>{STYLE}</style>

      {/* Indicateur « connecté » */}
      <div style={{ position: 'absolute', top: 22, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 7, opacity: 0.7, pointerEvents: 'none' }}>
        <span style={{ position: 'relative', display: 'inline-flex', width: 6, height: 6, alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ position: 'absolute', width: 6, height: 6, borderRadius: '50%', background: '#3fbf6a', animation: 'ccaPing 1.9s ease-out infinite' }} />
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3fbf6a' }} />
        </span>
        <span style={{ fontSize: 11, color: 'rgba(244,239,230,.55)', letterSpacing: '.03em' }}>assistant cimolace · connecté</span>
      </div>

      {/* Présence */}
      <div className={`cca-${state}`} style={{ position: 'relative', width: 200, height: 120, pointerEvents: 'none' }}>
        <div className="cca-glow" />
        <span className="cca-form cca-boot" />
        <span className="cca-form cca-dot" />
        <span className="cca-form cca-line" />
        <span className="cca-form cca-wave"><i /><i style={{ animationDelay: '.1s' }} /><i style={{ animationDelay: '.2s' }} /><i style={{ animationDelay: '.3s' }} /><i style={{ animationDelay: '.4s' }} /></span>
        <span className="cca-form cca-done"><Check size={20} /></span>
      </div>

      {/* Message (voix) ou indice */}
      <div style={{ minHeight: 34, marginTop: 14, textAlign: 'center' }}>
        {message ? (
          <p key={message.length === 1 ? 'start' : 'msg'} className="cca-in" style={{ fontFamily: SERIF, fontSize: 19, lineHeight: 1.5, color: INK, maxWidth: 460, margin: 0 }}>
            {message}
          </p>
        ) : (
          state === 'attente' && !inputOpen && (
            <span style={{ fontSize: 12, color: 'rgba(244,239,230,.4)' }}>touchez l'écran pour parler</span>
          )
        )}
      </div>

      {/* Suggestions (attente) */}
      {state === 'attente' && !inputOpen && (
        <div className="cca-in" style={{ display: 'flex', flexWrap: 'wrap', gap: 9, justifyContent: 'center', marginTop: 18, maxWidth: 470 }}>
          {SUGG.map(({ kind, label, Icon }) => (
            <span
              key={kind}
              className="cca-chip"
              onClick={(e) => { e.stopPropagation(); pick(kind); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#e6cc92', background: 'rgba(244,239,230,.05)', borderRadius: 999, padding: '8px 15px' }}
            >
              <Icon size={14} />
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Saisie « parler à la présence » — apparaît au toucher / à la frappe, disparaît à l'Entrée */}
      {inputOpen && (
        <div
          className="cca-in"
          onClick={(e) => e.stopPropagation()}
          style={{ position: 'absolute', left: '50%', bottom: 40, transform: 'translateX(-50%)', width: 'min(440px, 86vw)', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(244,239,230,.07)', borderRadius: 14, padding: '8px 8px 8px 15px' }}
        >
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } else if (e.key === 'Escape') { closeInput(); } }}
            placeholder="Parlez à la présence…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: INK, fontSize: 14, fontFamily: 'inherit' }}
          />
          <button
            onClick={submit}
            aria-label="Envoyer"
            style={{ width: 32, height: 32, borderRadius: 9, background: '#d97757', color: '#2a140c', border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}
          >
            <ArrowUp size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
