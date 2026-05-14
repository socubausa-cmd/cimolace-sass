import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, ExternalLink, ShieldCheck, FileText, UserCheck, CreditCard, ThumbsUp, ThumbsDown, BookOpen } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { getBillingCheckoutPath } from '@/lib/eleveBillingPath';
import { Button } from '@/components/ui/button';

const EnrollmentModal = ({ pkg, onClose }) => {
  const val = (v) => (typeof v === 'string' ? v : v?.amount);
  const per = (v, fb) => (typeof v === 'string' ? fb : v?.period || fb);
  const noteOf = (v) => (typeof v === 'string' ? null : v?.note);
  const origOf = (v) => (typeof v === 'string' ? null : v?.original);

  const monthly   = { amount: val(pkg.pricing?.monthly),   period: per(pkg.pricing?.monthly, '/mois') };
  const quarterly = { amount: val(pkg.pricing?.quarterly), period: per(pkg.pricing?.quarterly, '/trimestre'), note: noteOf(pkg.pricing?.quarterly) };
  const full      = { amount: val(pkg.pricing?.full),      original: origOf(pkg.pricing?.full), note: noteOf(pkg.pricing?.full) };
  const regFee    = pkg.pricing?.registration;

  const colors = {
    blue:   { header: 'from-blue-600 to-blue-800',     btn: 'bg-blue-600 hover:bg-blue-500',   outline: 'border-blue-400/30 text-blue-300 hover:bg-blue-500/10', accent: 'text-blue-400', tag: 'bg-blue-500/10 border-blue-500/20 text-blue-300' },
    yellow: { header: 'from-yellow-600 to-amber-800',   btn: 'bg-yellow-600 hover:bg-yellow-500', outline: 'border-yellow-400/30 text-yellow-300 hover:bg-yellow-500/10', accent: 'text-yellow-400', tag: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300' },
    red:    { header: 'from-red-600 to-red-900',        btn: 'bg-red-600 hover:bg-red-500',     outline: 'border-red-400/30 text-red-300 hover:bg-red-500/10', accent: 'text-red-400', tag: 'bg-red-500/10 border-red-500/20 text-red-300' },
    purple: { header: 'from-purple-600 to-purple-900',  btn: 'bg-purple-600 hover:bg-purple-500', outline: 'border-purple-400/30 text-purple-300 hover:bg-purple-500/10', accent: 'text-purple-400', tag: 'bg-purple-500/10 border-purple-500/20 text-purple-300' },
  };
  const c = colors[pkg.color] || colors.blue;

  const navigate = useNavigate();
  const { session } = useAuth();
  const [interval, setInterval] = useState('monthly');
  const [paymentMethod, setPaymentMethod] = useState('mobile_money');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const planSlug = useMemo(() => {
    const pkgId = String(pkg?.id || '').trim();
    const it = String(interval || '').trim();
    return `${pkgId}-${it}`;
  }, [pkg?.id, interval]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  if (!pkg) return null;

  const createPayment = async () => {
    setSubmitError('');
    const accessToken = session?.access_token;
    if (!accessToken) {
      setSubmitError("Connecte-toi pour t'abonner.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/.netlify/functions/billing-create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          planId: planSlug,
          paymentMethod,
          interval,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur paiement');
      const paymentId = data?.payment?.id;
      if (!paymentId) throw new Error('Paiement créé mais id manquant');
      onClose();
      navigate(getBillingCheckoutPath(paymentId));
    } catch (e) {
      setSubmitError(e?.message || 'Erreur paiement');
    } finally {
      setSubmitting(false);
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#111820] border border-white/10 shadow-2xl">

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-50 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className={`relative bg-gradient-to-r ${c.header} px-8 pt-8 pb-6`}>
          <div className="absolute inset-0 bg-black/15" />
          <div className="relative z-10 text-center">
            <span className="text-4xl block mb-2">{pkg.icon}</span>
            {pkg.badge && (
              <span className="inline-block mb-2 px-4 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white text-xs font-bold uppercase tracking-widest border border-white/25">
                {pkg.badge}
              </span>
            )}
            <h2 className="text-2xl font-bold text-white font-serif uppercase tracking-wide">{pkg.title}</h2>
            <p className="text-white/70 text-sm mt-1 italic">{pkg.subtitle}</p>
          </div>
        </div>

        <div className="p-6 md:p-8 space-y-8">

          {/* ====== SECTION 1 : CHOIX DU PAIEMENT ====== */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className={`w-5 h-5 ${c.accent}`} />
              <h3 className="text-lg font-bold text-white">Choisissez votre mode de paiement</h3>
            </div>

            <p className="text-sm text-gray-500 mb-1">Frais de configuration unique : <span className="text-white font-semibold">{regFee}</span></p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <div className="text-xs text-gray-500 uppercase tracking-wider">Période</div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setInterval('monthly')} className={`flex-1 h-10 rounded-lg border ${interval==='monthly' ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-white' : 'border-white/10 bg-black/20 text-gray-400 hover:bg-white/5'}`}>Mensuel</button>
                  <button type="button" onClick={() => setInterval('quarterly')} className={`flex-1 h-10 rounded-lg border ${interval==='quarterly' ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-white' : 'border-white/10 bg-black/20 text-gray-400 hover:bg-white/5'}`}>Trimestriel</button>
                  <button type="button" onClick={() => setInterval('yearly')} className={`flex-1 h-10 rounded-lg border ${interval==='yearly' ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-white' : 'border-white/10 bg-black/20 text-gray-400 hover:bg-white/5'}`}>Annuel</button>
                </div>
                <div className="text-[11px] text-gray-500">
                  {interval === 'monthly' ? `${monthly.amount}${monthly.period}` : interval === 'quarterly' ? `${quarterly.amount}${quarterly.period}` : `${full.amount}`}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs text-gray-500 uppercase tracking-wider">Moyen de paiement</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button type="button" onClick={() => setPaymentMethod('mobile_money')} className={`h-10 rounded-lg border ${paymentMethod==='mobile_money' ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-white' : 'border-white/10 bg-black/20 text-gray-400 hover:bg-white/5'}`}>Mobile Money</button>
                  <button type="button" onClick={() => setPaymentMethod('monero')} className={`h-10 rounded-lg border ${paymentMethod==='monero' ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-white' : 'border-white/10 bg-black/20 text-gray-400 hover:bg-white/5'}`}>Monero (XMR)</button>
                  <button type="button" onClick={() => setPaymentMethod('chariow')} className={`h-10 rounded-lg border ${paymentMethod==='chariow' ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-white' : 'border-white/10 bg-black/20 text-gray-400 hover:bg-white/5'}`}>Chariow</button>
                  <button type="button" onClick={() => setPaymentMethod('paypal')} className={`h-10 rounded-lg border ${paymentMethod==='paypal' ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-white' : 'border-white/10 bg-black/20 text-gray-400 hover:bg-white/5'}`}>PayPal</button>
                  <button type="button" onClick={() => setPaymentMethod('stripe')} className={`h-10 rounded-lg border ${paymentMethod==='stripe' ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-white' : 'border-white/10 bg-black/20 text-gray-400 hover:bg-white/5'}`}>Carte (Stripe)</button>
                </div>
                <div className="text-[11px] text-gray-500">
                  {paymentMethod === 'monero'
                    ? 'Paiement en XMR (Monero) via NOWPayments.'
                    : paymentMethod === 'chariow'
                      ? 'Paiement via checkout securise Chariow.'
                      : paymentMethod === 'paypal'
                        ? 'Paiement via PayPal (Orders v2 ; credentials tenant ou plateforme).'
                        : paymentMethod === 'stripe'
                          ? 'Paiement carte via Stripe Checkout (client_reference_id = id paiement ; webhook `checkout.session.completed`).'
                      : 'Paiement Mobile Money via CinetPay.'}
                </div>
              </div>
            </div>

            {submitError ? (
              <div className="mt-4 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                {submitError}
              </div>
            ) : null}

            <Button
              type="button"
              onClick={createPayment}
              disabled={submitting}
              className={`w-full h-12 font-bold mt-4 ${c.btn}`}
            >
              {submitting ? 'Création du paiement…' : 'Continuer vers le paiement'}
            </Button>

            <div className="text-xs text-gray-500 mt-3">
              Votre abonnement sera activé automatiquement après confirmation du paiement (webhook sécurisé).
            </div>
          </div>

          {/* Separator */}
          <div className="border-t border-white/5" />

          {/* ====== SECTION 2 : CONTENU DU FORFAIT ====== */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <FileText className={`w-5 h-5 ${c.accent}`} />
              <h3 className="text-lg font-bold text-white">Ce que contient ce forfait</h3>
            </div>

            <div className="bg-white/[0.02] rounded-xl border border-white/5 p-5">
              <p className="text-sm text-gray-400 mb-4 leading-relaxed">{pkg.targetAudience}</p>

              <ul className="space-y-2.5">
                {pkg.inclusions.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-gray-200">
                    <Check className={`w-4 h-4 mt-0.5 shrink-0 ${c.accent}`} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {pkg.exclusions && pkg.exclusions.length > 0 && (
                <div className="mt-4 pt-3 border-t border-white/5">
                  <p className="text-sm text-gray-500 font-semibold uppercase tracking-wider mb-2">Non inclus :</p>
                  <ul className="space-y-1.5">
                    {pkg.exclusions.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-500 italic">
                        <X className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-500/50" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {pkg.conditions && (
                <p className="text-[11px] text-amber-400/80 mt-4 bg-amber-500/5 border border-amber-500/10 rounded-lg p-3">
                  {pkg.conditions}
                </p>
              )}
            </div>
          </div>

          {/* Separator */}
          <div className="border-t border-white/5" />

          {/* ====== SECTION 3 : EN SAVOIR PLUS ====== */}
          {(pkg.avantages || pkg.inconvenients) && (
            <div>
              <div className="flex items-center gap-2 mb-5">
                <BookOpen className={`w-5 h-5 ${c.accent}`} />
                <h3 className="text-lg font-bold text-white">En savoir plus</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Avantages */}
                {pkg.avantages && pkg.avantages.length > 0 && (
                  <div className="bg-emerald-500/[0.04] border border-emerald-500/10 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ThumbsUp className="w-4 h-4 text-emerald-400" />
                      <p className="text-sm font-bold text-emerald-400 uppercase tracking-wider">Avantages</p>
                    </div>
                    <ul className="space-y-2">
                      {pkg.avantages.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                          <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-400" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Inconvenients */}
                {pkg.inconvenients && pkg.inconvenients.length > 0 && (
                  <div className="bg-orange-500/[0.04] border border-orange-500/10 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ThumbsDown className="w-4 h-4 text-orange-400" />
                      <p className="text-sm font-bold text-orange-400 uppercase tracking-wider">A considerer</p>
                    </div>
                    <ul className="space-y-2">
                      {pkg.inconvenients.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                          <X className="w-3.5 h-3.5 mt-0.5 shrink-0 text-orange-400/60" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Conseil */}
              {pkg.advice && (
                <div className={`mt-4 flex items-start gap-2.5 bg-white/[0.02] border border-white/5 rounded-lg p-3`}>
                  <span className="text-lg mt-0.5">💡</span>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    <span className={`font-bold ${c.accent}`}>Conseil : </span>
                    {pkg.advice}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Separator */}
          <div className="border-t border-white/5" />

          {/* ====== SECTION 4 : SUIVI POST-PAIEMENT ====== */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <UserCheck className={`w-5 h-5 ${c.accent}`} />
              <h3 className="text-lg font-bold text-white">Apres votre paiement</h3>
            </div>

            <div className="space-y-4">
              <div className="flex gap-3 items-start bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-sm font-bold text-emerald-400">1</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-300">Prise en charge immediate</p>
                  <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                    Des la validation de votre paiement, vous serez contacte en prive par un encadreur dedie
                    qui vous accompagnera tout au long de votre parcours.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start bg-blue-500/5 border border-blue-500/10 rounded-xl p-4">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-sm font-bold text-blue-400">2</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-300">Premier entretien personnalise</p>
                  <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                    Un premier entretien prive sera programme pour evaluer votre profil,
                    definir vos objectifs et etablir votre plan de formation personnalise.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start bg-amber-500/5 border border-amber-500/10 rounded-xl p-4">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-300">Conservez votre preuve de paiement</p>
                  <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                    Apres le paiement sur PayPal, vous recevrez un recu par email.
                    <span className="text-amber-300 font-semibold"> Gardez precieusement ce recu</span> —
                    il vous sera demande lors de votre premier entretien pour confirmer votre inscription
                    et activer votre acces a la formation.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Separator */}
          <div className="border-t border-white/5" />

          {/* ====== SECTION 4 : ORIENTATION ====== */}
          <div className="text-center space-y-3">
            <p className="text-sm text-gray-300">
              Besoin d'aide pour choisir le bon forfait ?
            </p>
            <a
              href="/appointment/request"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-2 px-6 h-11 rounded-xl text-sm font-semibold no-underline transition-all duration-200 border ${c.outline} hover:scale-[1.02]`}
            >
              <UserCheck className="w-4 h-4" />
              Prendre rendez-vous avec un conseiller
              <ExternalLink className="w-3.5 h-3.5 opacity-50" />
            </a>
            <p className="text-[11px] text-gray-600">
              Entretien gratuit — Un conseiller vous orientera vers le cycle adapte a votre profil
            </p>
          </div>

          {/* Footer */}
          <div className="text-center pt-2 pb-2">
            <p className="text-[11px] text-gray-600">
              Paiement 100% securise via PayPal — Assistance disponible 7j/7
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default EnrollmentModal;
