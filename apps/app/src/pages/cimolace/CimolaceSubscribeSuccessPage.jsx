import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight } from 'lucide-react';

/**
 * Page de SUCCÈS après paiement d'acquisition (success_url du Checkout Stripe).
 * Le tenant est provisionné côté serveur via le webhook (checkout.session.completed),
 * indépendamment de cette redirection — d'où le ton « c'est prêt / en cours ».
 * Charte Cimolace : slate #0f1419, or #d8b468, serif Fraunces.
 */

const GOLD = '#d8b468';
const GOLD_SOFT = '#e6cc92';
const SERIF = "'Fraunces','Source Serif 4',Georgia,serif";

export default function CimolaceSubscribeSuccessPage() {
  return (
    <div className="min-h-screen bg-[#0f1419] text-[#f4efe6] flex flex-col items-center justify-center px-6 text-center"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <span className="w-16 h-16 rounded-2xl grid place-items-center mb-7 border border-[#d8b468]/30 bg-[#d8b468]/[0.10]">
        <CheckCircle2 className="w-8 h-8 text-[#d8b468]" />
      </span>

      <span className="inline-block text-[11px] font-semibold tracking-[0.22em] uppercase text-[#d8b468]/90 mb-4">
        Paiement confirmé
      </span>
      <h1 className="text-[clamp(1.9rem,4.5vw,3rem)] leading-[1.08] font-semibold max-w-[640px]"
        style={{ fontFamily: SERIF, letterSpacing: '-0.02em', textWrap: 'balance' }}>
        Votre espace est en cours de création.
      </h1>
      <p className="mt-5 text-[#aeb6bf] text-[15px] leading-relaxed max-w-[520px]">
        Merci — votre paiement est validé. Nous provisionnons votre infrastructure
        (quelques secondes) et vous recevez un email pour définir votre accès et
        vous connecter à votre organisation.
      </p>

      <div className="mt-9 flex flex-col sm:flex-row items-center gap-3">
        <Link to="/cimolace/login"
          className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-[#20160f] transition-all hover:-translate-y-[1px]"
          style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_SOFT})` }}>
          Accéder à mon espace <ArrowRight className="w-4 h-4" />
        </Link>
        <Link to="/souscrire" className="text-sm text-[#aeb6bf] hover:text-[#f4efe6] transition-colors px-4 py-3">
          Retour aux offres
        </Link>
      </div>

      <p className="mt-10 text-[11px] text-[#5b636e] max-w-[420px]">
        Un souci d'accès ? Écrivez-nous — votre abonnement est actif dès la confirmation du paiement.
      </p>
    </div>
  );
}
