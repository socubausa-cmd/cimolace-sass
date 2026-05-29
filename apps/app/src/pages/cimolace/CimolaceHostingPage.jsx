import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Cloud, Lock, Server, Shield } from 'lucide-react';
import CimolacePremiumShell from '@/components/cimolace/CimolacePremiumShell';
import { cimolacePlatformConfig } from '@/tenants/cimolace/cimolacePlatform.config';

const { routes, productName } = cimolacePlatformConfig;

const hostedFeatures = [
  'Mise en route en 24h',
  'Mises à jour automatiques',
  'Sauvegardes quotidiennes',
  'Scalabilité automatique selon le trafic',
  'Conformité RGPD garantie',
  'Support technique inclus',
];

const privateFeatures = [
  'Déployable sur AWS, GCP, Azure ou serveur dédié',
  'Vos données restent chez vous',
  'Support installation et maintenance',
  'Adapté aux institutions, écoles, ONG',
  'Audit de sécurité possible',
  'Tarification sur devis',
];

const faqItems = [
  {
    question: "Puis-je migrer d'un mode à l'autre ?",
    answer: "Oui. Vous pouvez commencer en hébergé CIMOLACE puis migrer vers une installation privée quand vos besoins de souveraineté évoluent.",
  },
  {
    question: 'Qui gère les mises à jour ?',
    answer: "En mode hébergé, CIMOLACE gère tout. En installation privée, votre équipe applique les releases, ou nous le faisons via maintenance.",
  },
  {
    question: 'Les données sont-elles chiffrées ?',
    answer: 'Oui. Les données sont chiffrées en transit et au repos. En installation privée, vous gardez le contrôle de votre infrastructure.',
  },
];

/**
 * @param {{
 *   icon: React.ReactNode,
 *   badge: string,
 *   title: string,
 *   description: string,
 *   features: string[],
 *   cta: string,
 *   to: string,
 *   featured?: boolean
 * }} props
 */
function HostingCard(props) {
  const { icon, badge, title, description, features, cta, to, featured = false } = props;
  return (
    <div
      className={`rounded-[2rem] border p-8 ${
        featured
          ? 'border-violet-500/40 bg-violet-500/10 shadow-2xl shadow-violet-950/30'
          : 'border-white/10 bg-white/[0.04]'
      }`}
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-cyan-300">{icon}</div>
        <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/55">
          {badge}
        </span>
      </div>
      <h2 className="mb-3 text-2xl font-black tracking-tight text-white">{title}</h2>
      <p className="mb-7 text-sm leading-relaxed text-white/60">{description}</p>
      <ul className="mb-8 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm text-white/70">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-400" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <Link
        to={to}
        className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-black transition ${
          featured ? 'bg-white text-[#0a0a0f] hover:bg-white/90' : 'border border-white/15 text-white hover:bg-white/[0.08]'
        }`}
      >
        {cta}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

export default function CimolaceHostingPage() {
  return (
    <>
      <Helmet>
        <title>Hébergement | {productName}</title>
        <meta
          name="description"
          content="CIMOLACE peut être hébergé chez nous ou installé sur votre infrastructure. Deux modes pour une même plateforme."
        />
      </Helmet>
      <CimolacePremiumShell>
        <main className="px-6 pb-24 pt-32">
          <section className="mx-auto mb-16 max-w-4xl text-center">
            <p className="mb-4 text-xs font-black uppercase tracking-[0.28em] text-violet-400">Infrastructure</p>
            <h1 className="mb-6 text-4xl font-black leading-[1.05] tracking-tight md:text-6xl">
              Deux modes.{' '}
              <span className="bg-gradient-to-r from-violet-400 to-cyan-300 bg-clip-text text-transparent">Vous choisissez.</span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-white/55">
              CIMOLACE peut être hébergé chez nous, sans charge technique, ou installé sur votre infrastructure pour une souveraineté totale.
            </p>
          </section>

          <section className="mx-auto mb-20 grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2">
            <HostingCard
              featured
              icon={<Cloud className="h-6 w-6" />}
              badge="Recommandé"
              title="Hébergé CIMOLACE"
              description="Vous connectez votre domaine. Nous gérons les mises à jour, sauvegardes, performances, sécurité et monitoring."
              features={hostedFeatures}
              cta="Créer ma plateforme"
              to={routes.installer}
            />
            <HostingCard
              icon={<Server className="h-6 w-6" />}
              badge="Souveraineté"
              title="Installation privée"
              description="CIMOLACE est déployé sur votre cloud, votre serveur ou votre infrastructure institutionnelle."
              features={privateFeatures}
              cta="Parler à un architecte"
              to={`${routes.contact}?intent=private-hosting`}
            />
          </section>

          <section className="mx-auto mb-20 grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { icon: Shield, title: 'Sécurité native', text: 'RBAC, isolation tenant, contrôle des accès et bonnes pratiques RGPD.' },
              { icon: Lock, title: 'Données maîtrisées', text: 'Mode hébergé pour la simplicité, mode privé pour les contraintes fortes.' },
              { icon: Server, title: 'Scalabilité', text: 'Infrastructure pensée pour gérer plusieurs OS, équipes, clients et pics de trafic.' },
            ].map((item) => (
              <div key={item.title} className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                <item.icon className="mb-5 h-7 w-7 text-cyan-300" />
                <h3 className="mb-2 text-lg font-black text-white">{item.title}</h3>
                <p className="text-sm leading-relaxed text-white/55">{item.text}</p>
              </div>
            ))}
          </section>

          <section className="mx-auto mb-20 max-w-4xl">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-violet-400">FAQ</p>
            <h2 className="mb-8 text-3xl font-black tracking-tight text-white">Questions fréquentes.</h2>
            <div className="space-y-4">
              {faqItems.map((item) => (
                <div key={item.question} className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                  <h3 className="mb-2 font-black text-white">{item.question}</h3>
                  <p className="text-sm leading-relaxed text-white/60">{item.answer}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-gradient-to-br from-violet-500/20 to-cyan-500/10 p-8 text-center">
            <h2 className="mb-3 text-3xl font-black tracking-tight text-white">Vous hésitez sur le bon mode ?</h2>
            <p className="mx-auto mb-7 max-w-2xl text-sm leading-relaxed text-white/65">
              Envoyez-nous vos contraintes : volume utilisateurs, pays d'hébergement, sécurité, équipes internes. Nous recommandons le mode adapté.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Link to={`${routes.contact}?intent=private-hosting`} className="rounded-2xl bg-white px-6 py-3 text-sm font-black text-[#0a0a0f]">
                Demander conseil
              </Link>
              <Link to={routes.architecture} className="rounded-2xl border border-white/15 px-6 py-3 text-sm font-black text-white hover:bg-white/[0.08]">
                Voir l'architecture
              </Link>
            </div>
          </section>
        </main>
      </CimolacePremiumShell>
    </>
  );
}
