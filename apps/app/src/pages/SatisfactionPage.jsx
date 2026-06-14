/**
 * SatisfactionPage — Enquête de satisfaction post-session
 * Route publique : /avis/:token
 *
 * L'élève clique sur une note (1-5 étoiles) + peut laisser un commentaire.
 * Soumet via POST /booking-satisfaction-submit.
 * Pas d'authentification requise — accès par token à usage unique.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Loader2, CheckCircle2, AlertCircle, Sparkles, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const LABELS = {
  1: 'Très insatisfait',
  2: 'Insatisfait',
  3: 'Correct',
  4: 'Satisfait',
  5: 'Très satisfait',
};

function StarRow({ selected, onSelect }) {
  const [hovered, setHovered] = useState(0);
  const active = hovered || selected;

  return (
    <div className="flex justify-center gap-2 py-4">
      {[1, 2, 3, 4, 5].map(n => (
        <motion.button
          key={n}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onSelect(n)}
          className="focus:outline-none"
          aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
        >
          <Star
            className={`w-10 h-10 transition-colors ${
              n <= active ? 'text-[var(--school-accent)] fill-[var(--school-accent)]' : 'text-white/20'
            }`}
          />
        </motion.button>
      ))}
    </div>
  );
}

export default function SatisfactionPage() {
  const { token }           = useParams();
  const [searchParams]      = useSearchParams();
  const [rating, setRating] = useState(Number(searchParams.get('rating')) || 0);
  const [comment, setComment] = useState('');
  const [state, setState]   = useState('idle'); // idle | submitting | done | error | expired | already
  const [errMsg, setErrMsg] = useState('');

  /* Auto-submit si rating fourni dans l'URL (clic direct depuis email) */
  useEffect(() => {
    const fromUrl = Number(searchParams.get('rating'));
    if (fromUrl >= 1 && fromUrl <= 5) {
      setRating(fromUrl);
    }
  }, [searchParams]);

  const handleSubmit = async () => {
    if (!rating || state === 'submitting' || state === 'done') return;
    setState('submitting');
    try {
      const res = await fetch('/.netlify/functions/booking-satisfaction-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, rating, comment: comment.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) { setState('already');  return; }
      if (res.status === 410) { setState('expired');  return; }
      if (!res.ok)            { setState('error'); setErrMsg(data?.error || 'Erreur inconnue'); return; }
      setState('done');
    } catch {
      setState('error');
      setErrMsg('Impossible de joindre le serveur. Réessayez.');
    }
  };

  /* ── États terminaux ── */
  if (state === 'done') {
    return (
      <div className="min-h-screen bg-[#090D14] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center space-y-6"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.1 }}
            className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto"
          >
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </motion.div>
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Merci pour votre avis !</h1>
            <p className="text-gray-400">
              Votre note de <span className="text-[var(--school-accent)] font-bold">{rating}/5 étoile{rating > 1 ? 's' : ''}</span> a bien été enregistrée.
            </p>
            <p className="text-gray-500 text-sm mt-2">Votre retour nous aide à améliorer l'accompagnement de chaque élève.</p>
          </div>
          <div className="flex justify-center gap-1">
            {[1,2,3,4,5].map(n => (
              <Star key={n} className={`w-7 h-7 ${n <= rating ? 'text-[var(--school-accent)] fill-[var(--school-accent)]' : 'text-white/15'}`} />
            ))}
          </div>
          <a href="/" className="inline-block text-sm text-[var(--school-accent)] hover:underline mt-4">
            Retour à l'accueil
          </a>
        </motion.div>
      </div>
    );
  }

  if (state === 'expired') {
    return <ErrorScreen icon="clock" title="Lien expiré" msg="Ce lien d'évaluation a expiré (7 jours après la session). Merci de nous contacter si vous souhaitez laisser un avis." />;
  }

  if (state === 'already') {
    return <ErrorScreen icon="check" title="Avis déjà soumis" msg="Vous avez déjà évalué cette session. Merci pour votre retour !" color="gold" />;
  }

  if (state === 'error') {
    return <ErrorScreen icon="alert" title="Une erreur s'est produite" msg={errMsg} retry={() => setState('idle')} />;
  }

  /* ── Formulaire principal ── */
  return (
    <div className="min-h-screen bg-[#090D14] flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Logo */}
        <div className="text-center">
          <p className="text-[var(--school-accent)] font-bold text-lg tracking-widest">{isnaTenantConfig.branding.name}</p>
          <p className="text-gray-600 text-xs">{isnaTenantConfig.branding.fullName}</p>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/10 bg-[#172437]/80 backdrop-blur-xl p-6 shadow-[0_24px_60px_rgba(0,0,0,0.5)] space-y-5"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] flex items-center justify-center">
              <Sparkles className="w-4.5 h-4.5 text-[var(--school-accent)]" />
            </div>
            <div>
              <p className="text-base font-semibold text-white">Comment s'est passé votre entretien ?</p>
              <p className="text-xs text-gray-500">Votre avis est confidentiel</p>
            </div>
          </div>

          {/* Stars */}
          <StarRow selected={rating} onSelect={setRating} />

          <AnimatePresence>
            {rating > 0 && (
              <motion.p
                key={rating}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center text-sm text-[var(--school-accent)] font-medium -mt-2"
              >
                {LABELS[rating]}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Comment */}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-500 uppercase tracking-wider">
              Commentaire <span className="text-gray-600">(optionnel)</span>
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Partagez votre expérience, suggestions…"
              rows={3}
              className="w-full resize-none rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] transition-colors"
            />
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={!rating || state === 'submitting'}
            className="w-full bg-[var(--school-accent)] text-black hover:bg-amber-400 font-bold flex items-center justify-center gap-2 h-11"
          >
            {state === 'submitting'
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />
            }
            {state === 'submitting' ? 'Envoi en cours…' : 'Envoyer mon avis'}
          </Button>
        </motion.div>

        <p className="text-center text-xs text-gray-600">
          Ce lien est valable 7 jours après votre entretien.
        </p>
      </div>
    </div>
  );
}

/* ── Helper component ── */
function ErrorScreen({ icon, title, msg, retry, color = 'red' }) {
  return (
    <div className="min-h-screen bg-[#090D14] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-4">
        <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center ${
          color === 'gold' ? 'bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]' : 'bg-red-500/15 border border-red-500/30'
        }`}>
          {icon === 'check'
            ? <CheckCircle2 className={`w-8 h-8 ${color === 'gold' ? 'text-[var(--school-accent)]' : 'text-emerald-400'}`} />
            : <AlertCircle className="w-8 h-8 text-red-400" />
          }
        </div>
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <p className="text-gray-400 text-sm">{msg}</p>
        {retry && (
          <button onClick={retry} className="text-[var(--school-accent)] underline text-sm">Réessayer</button>
        )}
      </div>
    </div>
  );
}
