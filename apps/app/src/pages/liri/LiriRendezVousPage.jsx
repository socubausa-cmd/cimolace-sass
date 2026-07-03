/**
 * LiriRendezVousPage — Demande de rendez-vous conversationnelle, PAGINÉE, dans LIRI.
 *
 * UX : l'assistant pose les 4 questions prévues — UNE PAR ÉCRAN (on ne PAS empiler les
 * messages en un flux : après chaque réponse, on « tourne la page » vers la question
 * suivante). Progression + historique via les puces d'étapes (✓ faites) et le récap
 * final ; navigation Retour/Continuer pour revoir/modifier.
 *
 * Couleurs = politique LIRI stricte : base #262624, coral (#e08a5f/#d97757) réservé aux
 * ACTIONS / à l'étape COURANTE / à la progression. Aucun navy, violet, or.
 *
 * Persistance : edge function `liri-appointment-request` (écriture serveur, service_role,
 * car les tables RDV ne sont pas écrivables côté client). Échec → message honnête + réessai.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Check, ArrowRight, ArrowLeft, ShieldCheck, RefreshCw, CalendarClock, Lock, Pencil } from 'lucide-react';
import LiriSchoolShell from '@/pages/liri/LiriSchoolShell';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/customSupabaseClient';

const C = {
  ink: '#f5f1e9', muted: 'rgba(245,241,233,0.64)', faint: 'rgba(245,241,233,0.42)',
  coral: '#e08a5f', coralDeep: '#d97757',
  surface: 'rgba(255,255,255,0.04)', line: 'rgba(255,255,255,0.08)',
  userLine: 'rgba(224,138,95,0.34)',
};

const STEPS = [
  { key: 'subject', short: 'Sujet', title: 'Quel est le sujet de ton entretien ?', hint: 'En quelques mots, ce dont tu veux parler.', placeholder: 'Ex : inscription, question sur un cours…', kind: 'text',
    validate: (v) => v.trim().length >= 3 || "Donne un sujet un peu plus précis (au moins 3 caractères)." },
  { key: 'description', short: 'Détails', optional: true, title: 'Tu veux préciser quelque chose ?', hint: 'Contexte, questions, degré d’urgence… (facultatif)', placeholder: 'Quelques précisions utiles…', kind: 'textarea',
    validate: () => true },
  { key: 'email', short: 'E-mail', title: 'À quelle adresse e-mail te confirmer ?', hint: 'Tu recevras la confirmation ici.', placeholder: 'toi@exemple.com', kind: 'email',
    validate: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) || "Cette adresse ne semble pas valide." },
  { key: 'whatsapp', short: 'WhatsApp', title: 'Ton numéro WhatsApp ?', hint: 'Format international (ex : +241…), pour te joindre facilement.', placeholder: '+241 00 00 00 00', kind: 'tel',
    validate: (v) => v.replace(/\D/g, '').length >= 8 || "Numéro trop court — indique un numéro complet." },
];

export default function LiriRendezVousPage() {
  const { user } = useAuth();

  const [step, setStep] = useState(0);          // 0..3 questions ; 4 récap ; 5 envoyé
  const [answers, setAnswers] = useState({ subject: '', description: '', email: '', whatsapp: '' });
  const [input, setInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);

  const cur = STEPS[step] || null;
  const progress = Math.min(step, STEPS.length) / STEPS.length;

  // Pré-remplir l'e-mail du compte.
  useEffect(() => { if (user?.email) setAnswers((a) => (a.email ? a : { ...a, email: user.email })); }, [user?.email]);

  // À chaque changement d'écran : recharger la réponse mémorisée + focus.
  useEffect(() => {
    if (step > 3) return;
    setErrorMsg('');
    setInput(answers[STEPS[step].key] || (STEPS[step].key === 'email' ? (user?.email || '') : ''));
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const goNext = () => {
    const s = STEPS[step];
    const value = input.trim();
    if (!value && !s.optional) { setErrorMsg('Cette réponse est requise.'); return; }
    if (value) { const ok = s.validate(value); if (ok !== true) { setErrorMsg(ok); return; } }
    setAnswers((a) => ({ ...a, [s.key]: value }));
    setStep(step + 1);
  };
  const goBack = () => { if (step > 0) setStep(step - 1); };

  const submit = async () => {
    setSubmitting(true); setErrorMsg('');
    try {
      const { data, error } = await supabase.functions.invoke('liri-appointment-request', {
        body: { subject: answers.subject, description: answers.description, email: answers.email, whatsapp: answers.whatsapp },
      });
      if (error || !data?.ok) throw new Error(error?.message || data?.error || 'submit_failed');
      setStep(5);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[rdv] submit échec:', e?.message);
      setErrorMsg("Ta demande n'a pas pu être transmise pour le moment.");
    } finally { setSubmitting(false); }
  };

  const restart = () => { setAnswers({ subject: '', description: '', email: user?.email || '', whatsapp: '' }); setErrorMsg(''); setStep(0); };

  return (
    <LiriSchoolShell active="agenda">
      <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--base, #262624)', position: 'relative' }}>
        <style>{`
          @keyframes rdvIn { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }
          @keyframes rdvSpin { to { transform: rotate(360deg) } }
          .rdv-spin { animation: rdvSpin .8s linear infinite; }
          .rdv-screen { animation: rdvIn .42s cubic-bezier(.22,1,.36,1) both; }
          .rdv-field::placeholder { color: rgba(245,241,233,0.34) }
        `}</style>
        <div aria-hidden style={{ position: 'absolute', top: -70, left: '50%', width: 620, height: 300, transform: 'translateX(-50%)', borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(217,119,87,0.10), transparent 72%)', filter: 'blur(60px)', pointerEvents: 'none' }} />

        {/* En-tête + progression + puces d'étapes (l'historique) */}
        <header style={{ position: 'relative', zIndex: 1, padding: '20px 22px 14px', borderBottom: `1px solid ${C.line}` }}>
          <div style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 11, background: 'rgba(224,138,95,0.16)', border: `1px solid ${C.userLine}` }}><Sparkles size={16} color={C.coral} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.coral }}>Assistant rendez-vous</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>Une question à la fois</div>
              </div>
              <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: C.faint }}>{Math.min(step, STEPS.length)} / {STEPS.length}</span>
            </div>
            <div style={{ marginTop: 13, height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress * 100}%`, borderRadius: 4, background: `linear-gradient(90deg, ${C.coralDeep}, ${C.coral})`, transition: 'width .5s cubic-bezier(.22,1,.36,1)' }} />
            </div>
            <div style={{ marginTop: 11, display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {STEPS.map((s, i) => {
                const d = i < step, c = i === step;
                const canJump = i < step; // revoir une étape déjà faite
                return (
                  <button key={s.key} onClick={() => canJump && setStep(i)} disabled={!canJump} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 600,
                    cursor: canJump ? 'pointer' : 'default',
                    background: c ? 'rgba(224,138,95,0.14)' : d ? 'rgba(255,255,255,0.05)' : 'transparent',
                    border: `1px solid ${c ? C.userLine : d ? C.line : 'rgba(255,255,255,0.05)'}`,
                    color: c ? C.coral : d ? C.muted : C.faint,
                  }}>
                    <span style={{ display: 'grid', placeItems: 'center', width: 16, height: 16, borderRadius: '50%', fontSize: 9, fontWeight: 800,
                      background: d ? C.coral : 'transparent', border: d ? 'none' : `1.5px solid ${c ? C.coral : 'rgba(245,241,233,0.24)'}`, color: d ? '#1c140e' : c ? C.coral : C.faint }}>
                      {d ? <Check size={10} /> : i + 1}
                    </span>
                    {s.short}
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        {/* Corps : UN écran à la fois */}
        <div style={{ position: 'relative', zIndex: 1, flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px 22px' }}>
          <div style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>

            {/* Question (étape 0..3) */}
            {step <= 3 && cur && (
              <div key={step} className="rdv-screen">
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span style={{ display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: 8, background: 'rgba(224,138,95,0.14)', border: '1px solid rgba(224,138,95,0.3)' }}><Sparkles size={13} color={C.coral} /></span>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: C.faint }}>Étape {step + 1} sur {STEPS.length}</span>
                </div>
                <h2 style={{ fontSize: 25, fontWeight: 800, color: C.ink, lineHeight: 1.2, letterSpacing: '-0.01em', textWrap: 'balance', margin: 0 }}>{cur.title}</h2>
                {cur.hint && <p style={{ fontSize: 14, color: C.muted, marginTop: 8 }}>{cur.hint}</p>}

                <div style={{ marginTop: 20, background: C.surface, border: `1px solid ${errorMsg ? C.userLine : C.line}`, borderRadius: 14, padding: cur.kind === 'textarea' ? '10px 14px' : '4px 14px' }}>
                  {cur.kind === 'textarea' ? (
                    <textarea ref={inputRef} className="rdv-field" value={input} onChange={(e) => { setInput(e.target.value); if (errorMsg) setErrorMsg(''); }} placeholder={cur.placeholder}
                      onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); goNext(); } }} rows={3}
                      style={{ width: '100%', resize: 'none', background: 'transparent', border: 'none', outline: 'none', color: C.ink, fontSize: 15.5, lineHeight: 1.55 }} />
                  ) : (
                    <input ref={inputRef} className="rdv-field" value={input} onChange={(e) => { setInput(e.target.value); if (errorMsg) setErrorMsg(''); }} placeholder={cur.placeholder}
                      type={cur.kind === 'email' ? 'email' : cur.kind === 'tel' ? 'tel' : 'text'} inputMode={cur.kind === 'tel' ? 'tel' : undefined}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); goNext(); } }}
                      style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: C.ink, fontSize: 16, padding: '12px 0' }} />
                  )}
                </div>
                {errorMsg && <p style={{ marginTop: 8, fontSize: 12.5, color: C.coral }}>{errorMsg}</p>}

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 22 }}>
                  {step > 0 && (
                    <button onClick={goBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '11px 16px', borderRadius: 12, background: 'transparent', border: `1px solid ${C.line}`, cursor: 'pointer', color: C.muted, fontSize: 13.5, fontWeight: 600 }}>
                      <ArrowLeft size={15} /> Retour
                    </button>
                  )}
                  <button onClick={goNext}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px', borderRadius: 12, border: 'none', cursor: 'pointer', background: `linear-gradient(180deg, ${C.coral}, ${C.coralDeep})`, color: '#1c140e', fontSize: 14, fontWeight: 800 }}>
                    {step === 3 ? 'Vérifier' : 'Continuer'} <ArrowRight size={16} />
                  </button>
                  {cur.optional && <button onClick={() => { setInput(''); setStep(step + 1); }} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 12.5, fontWeight: 600 }}>Passer →</button>}
                </div>
                <p style={{ marginTop: 20, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: C.faint }}><Lock size={11} /> Traité par le secrétariat de ton école</p>
              </div>
            )}

            {/* Récap (étape 4) */}
            {step === 4 && (
              <div key="recap" className="rdv-screen">
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span style={{ display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: 8, background: 'rgba(224,138,95,0.14)', border: '1px solid rgba(224,138,95,0.3)' }}><Sparkles size={13} color={C.coral} /></span>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: C.faint }}>Dernière étape</span>
                </div>
                <h2 style={{ fontSize: 25, fontWeight: 800, color: C.ink, lineHeight: 1.2, margin: 0 }}>On récapitule, puis on valide.</h2>
                <div style={{ marginTop: 18, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, overflow: 'hidden' }}>
                  {[['Sujet', answers.subject, 0], ['Détails', answers.description || '—', 1], ['E-mail', answers.email, 2], ['WhatsApp', answers.whatsapp, 3]].map(([k, v, idx], row) => (
                    <button key={k} onClick={() => setStep(idx)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '13px 16px', background: 'transparent', border: 'none', borderTop: row ? `1px solid ${C.line}` : 'none', cursor: 'pointer' }}>
                      <span style={{ width: 76, flexShrink: 0, fontSize: 12, color: C.faint }}>{k}</span>
                      <span style={{ flex: 1, fontSize: 13.5, color: C.ink, overflowWrap: 'anywhere' }}>{v}</span>
                      <Pencil size={13} color={C.faint} />
                    </button>
                  ))}
                </div>
                {errorMsg && <p style={{ marginTop: 10, fontSize: 12.5, color: C.coral }}>⚠︎ {errorMsg} Réessaie, ou contacte le secrétariat.</p>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 20 }}>
                  <button onClick={() => setStep(3)} disabled={submitting} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '11px 16px', borderRadius: 12, background: 'transparent', border: `1px solid ${C.line}`, cursor: 'pointer', color: C.muted, fontSize: 13.5, fontWeight: 600 }}>
                    <ArrowLeft size={15} /> Retour
                  </button>
                  <button onClick={submit} disabled={submitting}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px', borderRadius: 12, border: 'none', cursor: submitting ? 'wait' : 'pointer', background: `linear-gradient(180deg, ${C.coral}, ${C.coralDeep})`, color: '#1c140e', fontSize: 14, fontWeight: 800, opacity: submitting ? 0.7 : 1 }}>
                    {submitting ? <RefreshCw size={15} className="rdv-spin" /> : <ShieldCheck size={15} />} {submitting ? 'Envoi…' : 'Valider ma demande'}
                  </button>
                </div>
              </div>
            )}

            {/* Confirmation (étape 5) */}
            {step === 5 && (
              <div key="done" className="rdv-screen" style={{ textAlign: 'center', padding: '10px 0' }}>
                <span style={{ display: 'grid', placeItems: 'center', width: 60, height: 60, borderRadius: '50%', margin: '0 auto 16px', background: 'rgba(224,138,95,0.16)', border: `1px solid ${C.userLine}` }}><CalendarClock size={28} color={C.coral} /></span>
                <h2 style={{ fontSize: 23, fontWeight: 800, color: C.ink, margin: 0 }}>Demande transmise ✅</h2>
                <p style={{ fontSize: 14, color: C.muted, marginTop: 8, maxWidth: 440, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.55 }}>
                  Le secrétariat te proposera un créneau et te confirmera par e-mail et WhatsApp. Tu la retrouveras dans « Demandes en attente » de ton agenda.
                </p>
                <button onClick={restart} style={{ marginTop: 18, padding: '11px 18px', borderRadius: 12, background: 'transparent', border: `1px solid ${C.line}`, cursor: 'pointer', color: C.muted, fontSize: 13, fontWeight: 600 }}>Nouvelle demande</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </LiriSchoolShell>
  );
}
