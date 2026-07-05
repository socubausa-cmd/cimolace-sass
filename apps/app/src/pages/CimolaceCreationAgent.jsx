/**
 * CimolaceCreationAgent — assistant conversationnel immersif de création d'organisation.
 * Route (preview) : /creer-organisation/agent
 *
 * LOT 2 (cette version) : coque immersive L1 + MACHINE À ÉTATS du flux de création,
 * branchée sur les vrais endpoints (check-slug + POST /signup/tenant + login).
 *   Flux : discovery → produit → marque (nom + slug vérifié) → compte → prêt.
 *   - Présence 5 états (connexion/attente/réflexion/écriture/prêt) câblée aux événements.
 *   - Saisie « parler à la présence » (toucher / type-anywhere) pour le texte libre et le
 *     NOM de l'organisation ; l'étape COMPTE a un vrai formulaire (e-mail + mot de passe) —
 *     le mot de passe est saisi par l'utilisateur, jamais par l'agent.
 *   - Le « cerveau » IA (routeur d'intention + réponses génératives + tunnel de vente)
 *     arrive au LOT 3 (edge agent-brain) ; ici les réponses restent préécrites.
 *
 * Réutilise la logique de OnboardingOrgPage.jsx (endpoints identiques, prouvés en prod).
 * Cf. mémoire projet `cimolace-creation-agent-immersif` pour la direction complète (L1→L5).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Stethoscope, ShoppingBag, ArrowUp, ArrowRight, Check, Loader2, Mail, Lock } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/apiBase';
import { useAuth } from '@/hooks/useAuth';
import { authStore } from '@/lib/auth-store';

const BG = '#262624';
const BG_THINK = '#20232a';
const INK = '#f4efe6';
const TERRA = '#d97757';
const GOLD = '#e6cc92';
const SERIF = "'Fraunces','Source Serif 4',Georgia,serif";

const GREETING = "Bonjour. Dites-moi ce que vous voulez lancer — je m'occupe du reste.";

const SUGG = [
  { kind: 'school', label: 'École / cours en ligne', Icon: GraduationCap },
  { kind: 'medos', label: 'Clinique / santé', Icon: Stethoscope },
  { kind: 'shop', label: 'Boutique en ligne', Icon: ShoppingBag },
];

// Mon « kind » d'UI → « kind » attendu par POST /signup/tenant
const KIND_MAP = { school: 'school', medos: 'medos', shop: 'mbolo' };

const PRODUCT = {
  school: { tag: 'LIRI École', reply: "Parfait — LIRI École : lives, cours, smartboard IA, replay. On construit votre espace ?" },
  medos: { tag: 'MedOS', reply: "Pour une clinique, MedOS : dossiers, notes SOAP, téléconsultation, RGPD. On le met en place ?" },
  shop: { tag: 'Virtuel Mbolo', reply: "Pour vendre en ligne, Virtuel Mbolo : catalogue, panier, mobile money. On lance votre boutique ?" },
};

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}

function guessKind(v) {
  const s = (v || '').toLowerCase();
  if (/clin|sant|patient|m[ée]dec|soin/.test(s)) return 'medos';
  if (/boutiq|vend|produit|commerce|magasin|mbolo/.test(s)) return 'shop';
  return 'school';
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
/* Les animations ne tournent QUE dans l'état actif (sinon leurs keyframes d'opacité écrasent le masquage). */
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
.cca-field::placeholder{color:rgba(244,239,230,.35)}
`;

export default function CimolaceCreationAgent() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [presence, setPresence] = useState('connexion'); // connexion|attente|reflexion|ecriture|pret
  const [message, setMessage] = useState('');
  const [step, setStep] = useState('discovery'); // discovery|product|brand_ask|brand_confirm|account|pret

  const [chosen, setChosen] = useState('school');
  const [orgName, setOrgName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugState, setSlugState] = useState({ checking: false, available: null });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [inputOpen, setInputOpen] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef(null);
  const typeTimer = useRef(null);
  const thinkTimer = useRef(null);
  const rootRef = useRef(null);
  const genRef = useRef(0);

  const inputAllowed = step === 'discovery' || step === 'brand_ask';

  // Typewriter robuste par « génération » : chaque speak() incrémente un jeton ; toute
  // frappe périmée (nouvelle frappe, ou double-mount StrictMode) s'arrête d'elle-même via
  // le garde genRef. setTimeout récursif = zéro interval orphelin.
  const speak = useCallback((text, done) => {
    const gen = ++genRef.current;
    clearTimeout(typeTimer.current);
    // Onglet masqué (les timers y sont throttlés → frappe saccadée) ou reduced-motion :
    // on écrit le texte instantanément plutôt que d'animer.
    if (document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setMessage(text);
      setPresence('attente');
      if (done) done();
      return;
    }
    setPresence('ecriture');
    setMessage('');
    let i = 0;
    const tick = () => {
      if (genRef.current !== gen) return; // périmée → stop
      i += 1;
      setMessage(text.slice(0, i));
      if (i >= text.length) {
        setPresence('attente');
        if (done) done();
        return;
      }
      typeTimer.current = setTimeout(tick, 22);
    };
    typeTimer.current = setTimeout(tick, 22);
  }, []);

  const think = useCallback((fn, delay = 1000) => {
    setPresence('reflexion');
    clearTimeout(thinkTimer.current);
    thinkTimer.current = setTimeout(fn, delay);
  }, []);

  // Éveil
  useEffect(() => {
    const t = setTimeout(() => speak(GREETING), 900);
    return () => { clearTimeout(t); clearInterval(typeTimer.current); clearTimeout(thinkTimer.current); };
  }, [speak]);

  const openInput = useCallback((prefill = '') => {
    setInputOpen(true);
    setValue(prefill);
    setTimeout(() => inputRef.current?.focus(), 30);
  }, []);
  const closeInput = useCallback(() => { setInputOpen(false); setValue(''); }, []);

  // « type-anywhere » — seulement là où le texte libre a du sens
  useEffect(() => {
    const onKey = (e) => {
      if (inputOpen || !inputAllowed) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key && e.key.length === 1) openInput(e.key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inputOpen, inputAllowed, openInput]);

  const checkSlug = useCallback(async (s) => {
    if (s.length < 2) { setSlugState({ checking: false, available: null }); return; }
    setSlugState({ checking: true, available: null });
    try {
      const res = await fetch(`${getApiBaseUrl()}/signup/tenant/check-slug`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: s }),
      });
      const body = await res.json().catch(() => ({}));
      const payload = body?.data ?? body;
      setSlugState({ checking: false, available: Boolean(payload?.available) });
    } catch {
      setSlugState({ checking: false, available: null });
    }
  }, []);

  // ── Transitions de flux ────────────────────────────────────────────────
  const pickKind = useCallback((k) => {
    setChosen(k);
    setError('');
    think(() => { setStep('product'); speak(PRODUCT[k].reply); });
  }, [think, speak]);

  const chooseProduct = useCallback(() => {
    setStep('brand_ask');
    speak("Comment s'appelle votre organisation ? Dites-le moi.", () => openInput());
  }, [speak, openInput]);

  const submitName = useCallback((name) => {
    const s = slugify(name);
    setOrgName(name);
    setSlug(s);
    checkSlug(s);
    think(() => { setStep('brand_confirm'); speak(`Parfait. Votre espace : cimolace.space/t/${s || '…'}. On continue ?`); });
  }, [think, speak, checkSlug]);

  const continueToAccount = useCallback(() => {
    setStep('account');
    speak("Dernière étape : votre e-mail et un mot de passe (8 caractères min). Vous saisissez, je crée l'espace.");
  }, [speak]);

  const submitInput = useCallback(() => {
    const v = value.trim();
    closeInput();
    if (!v) return;
    if (step === 'brand_ask') { submitName(v); return; }
    const k = guessKind(v);
    setChosen(k);
    think(() => { setStep('product'); speak(PRODUCT[k].reply); });
  }, [value, step, closeInput, submitName, think, speak]);

  const createAccount = useCallback(async () => {
    setError('');
    if (!email.trim() || !password) { setError('E-mail et mot de passe requis.'); return; }
    if (password.length < 8) { setError('Mot de passe : 8 caractères minimum.'); return; }
    if (slug.length < 2) { setError("Le nom d'organisation ne produit pas d'identifiant valide."); return; }
    setBusy(true);
    setPresence('reflexion');
    try {
      const res = await fetch(`${getApiBaseUrl()}/signup/tenant`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, platformName: orgName.trim(), slug, kind: KIND_MAP[chosen] || 'liri' }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error?.message || body?.message || 'Création impossible. Réessayez.');
      const payload = body?.data ?? body;
      const createdSlug = payload?.tenant?.slug || slug;
      const nextUrl = payload?.next_url || `/t/${createdSlug}/admin`;
      authStore.setTenantSlug(createdSlug);
      setStep('pret');
      setPresence('pret');
      setMessage(`Votre espace ${PRODUCT[chosen].tag} est prêt.`);
      const { error: loginErr } = await login(email.trim(), password);
      setTimeout(() => navigate(loginErr ? '/login' : nextUrl, { replace: true }), 1500);
    } catch (err) {
      setError(err?.message || 'Une erreur est survenue.');
      setPresence('attente');
    } finally {
      setBusy(false);
    }
  }, [email, password, slug, orgName, chosen, login, navigate]);

  const onRootClick = (e) => {
    if (inputOpen || !inputAllowed) return;
    if (rootRef.current && e.target === rootRef.current) openInput();
  };

  const bg = presence === 'reflexion' ? BG_THINK : BG;
  const showActions = presence === 'attente' && !inputOpen;

  return (
    <div
      ref={rootRef}
      onClick={onRootClick}
      style={{
        minHeight: '100vh', background: bg, transition: 'background .8s ease',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden', padding: '0 24px',
        fontFamily: "'Inter', system-ui, sans-serif", cursor: inputOpen || !inputAllowed ? 'default' : 'text',
      }}
    >
      <style>{STYLE}</style>

      {/* Connecté */}
      <div style={{ position: 'absolute', top: 22, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 7, opacity: 0.7, pointerEvents: 'none' }}>
        <span style={{ position: 'relative', display: 'inline-flex', width: 6, height: 6, alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ position: 'absolute', width: 6, height: 6, borderRadius: '50%', background: '#3fbf6a', animation: 'ccaPing 1.9s ease-out infinite' }} />
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3fbf6a' }} />
        </span>
        <span style={{ fontSize: 11, color: 'rgba(244,239,230,.55)', letterSpacing: '.03em' }}>assistant cimolace · connecté</span>
      </div>

      {/* Présence */}
      <div className={`cca-${presence}`} style={{ position: 'relative', width: 200, height: 120, pointerEvents: 'none' }}>
        <div className="cca-glow" />
        <span className="cca-form cca-boot" />
        <span className="cca-form cca-dot" />
        <span className="cca-form cca-line" />
        <span className="cca-form cca-wave"><i /><i style={{ animationDelay: '.1s' }} /><i style={{ animationDelay: '.2s' }} /><i style={{ animationDelay: '.3s' }} /><i style={{ animationDelay: '.4s' }} /></span>
        <span className="cca-form cca-done"><Check size={20} /></span>
      </div>

      {/* Voix */}
      <div style={{ minHeight: 34, marginTop: 14, textAlign: 'center' }}>
        {message ? (
          <p className="cca-in" style={{ fontFamily: SERIF, fontSize: 19, lineHeight: 1.5, color: INK, maxWidth: 470, margin: 0 }}>{message}</p>
        ) : (
          showActions && step === 'discovery' && <span style={{ fontSize: 12, color: 'rgba(244,239,230,.4)' }}>touchez l'écran pour parler</span>
        )}
      </div>

      {/* Erreur */}
      {error && (
        <p className="cca-in" style={{ marginTop: 10, fontSize: 12.5, color: '#f0997b' }}>{error}</p>
      )}

      {/* Actions par étape */}
      {showActions && step === 'discovery' && (
        <div className="cca-in" style={{ display: 'flex', flexWrap: 'wrap', gap: 9, justifyContent: 'center', marginTop: 18, maxWidth: 470 }}>
          {SUGG.map(({ kind, label, Icon }) => (
            <span key={kind} className="cca-chip" onClick={(e) => { e.stopPropagation(); pickKind(kind); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: GOLD, background: 'rgba(244,239,230,.05)', borderRadius: 999, padding: '8px 15px' }}>
              <Icon size={14} />{label}
            </span>
          ))}
        </div>
      )}

      {showActions && step === 'product' && (
        <div className="cca-in" style={{ display: 'flex', gap: 9, justifyContent: 'center', marginTop: 18 }}>
          <button className="cca-chip" onClick={(e) => { e.stopPropagation(); chooseProduct(); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 500, color: '#2a140c', background: TERRA, border: 'none', borderRadius: 11, padding: '10px 18px', cursor: 'pointer' }}>
            Choisir {PRODUCT[chosen].tag}<ArrowRight size={15} />
          </button>
          <button className="cca-chip" onClick={(e) => { e.stopPropagation(); const o = ['school', 'medos', 'shop'].filter((x) => x !== chosen); pickKind(o[0]); }}
            style={{ fontSize: 13, color: 'rgba(244,239,230,.6)', background: 'rgba(244,239,230,.05)', border: 'none', borderRadius: 11, padding: '10px 15px', cursor: 'pointer' }}>
            Autre
          </button>
        </div>
      )}

      {showActions && step === 'brand_confirm' && (
        <div className="cca-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <span style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6, color: slugState.available === false ? '#f0997b' : '#7fe0a0' }}>
            {slugState.checking ? (<><Loader2 size={13} className="animate-spin" /> vérification…</>)
              : slugState.available === false ? (<>identifiant déjà pris — changez le nom</>)
                : slugState.available ? (<><Check size={13} /> identifiant disponible</>)
                  : (<>cimolace.space/t/{slug}</>)}
          </span>
          <div style={{ display: 'flex', gap: 9 }}>
            <button className="cca-chip" disabled={slugState.available === false} onClick={(e) => { e.stopPropagation(); continueToAccount(); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 500, color: '#2a140c', background: slugState.available === false ? 'rgba(217,119,87,.4)' : TERRA, border: 'none', borderRadius: 11, padding: '10px 18px', cursor: slugState.available === false ? 'not-allowed' : 'pointer' }}>
              Continuer<ArrowRight size={15} />
            </button>
            <button className="cca-chip" onClick={(e) => { e.stopPropagation(); setStep('brand_ask'); speak('Quel nom, alors ?', () => openInput()); }}
              style={{ fontSize: 13, color: 'rgba(244,239,230,.6)', background: 'rgba(244,239,230,.05)', border: 'none', borderRadius: 11, padding: '10px 15px', cursor: 'pointer' }}>
              Changer le nom
            </button>
          </div>
        </div>
      )}

      {showActions && step === 'account' && (
        <form className="cca-in" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); createAccount(); }}
          style={{ display: 'flex', flexDirection: 'column', gap: 9, width: 320, marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'rgba(244,239,230,.05)', borderRadius: 11, padding: '10px 13px' }}>
            <Mail size={15} color="rgba(244,239,230,.4)" />
            <input className="cca-field" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: INK, fontSize: 13.5, fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'rgba(244,239,230,.05)', borderRadius: 11, padding: '10px 13px' }}>
            <Lock size={15} color="rgba(244,239,230,.4)" />
            <input className="cca-field" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe (8 car. min)"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: INK, fontSize: 13.5, fontFamily: 'inherit' }} />
          </div>
          <button type="submit" disabled={busy}
            style={{ marginTop: 4, background: TERRA, color: '#2a140c', border: 'none', borderRadius: 11, padding: '11px', fontSize: 13.5, fontWeight: 500, cursor: busy ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            {busy ? (<><Loader2 size={15} className="animate-spin" /> Création…</>) : (<>Créer mon espace<ArrowRight size={15} /></>)}
          </button>
        </form>
      )}

      {/* Saisie « parler à la présence » */}
      {inputOpen && (
        <div className="cca-in" onClick={(e) => e.stopPropagation()}
          style={{ position: 'absolute', left: '50%', bottom: 40, transform: 'translateX(-50%)', width: 'min(440px, 86vw)', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(244,239,230,.07)', borderRadius: 14, padding: '8px 8px 8px 15px' }}>
          <input ref={inputRef} className="cca-field" value={value} onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitInput(); } else if (e.key === 'Escape') { closeInput(); } }}
            placeholder={step === 'brand_ask' ? 'Nom de votre organisation…' : 'Parlez à la présence…'}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: INK, fontSize: 14, fontFamily: 'inherit' }} />
          <button onClick={submitInput} aria-label="Envoyer"
            style={{ width: 32, height: 32, borderRadius: 9, background: TERRA, color: '#2a140c', border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
            <ArrowUp size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
