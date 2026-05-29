/**
 * Guide comparatif des constructeurs — audit produit & cahier des charges.
 * Route : /studio/liri/constructeurs/guide
 */
import React from 'react';
import { Link } from 'react-router-dom';
import {
  Compass, ArrowLeft, CheckCircle2, XCircle, BookMarked, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import StudioDesignerLikeShell from '@/components/liri-ecosystem/StudioDesignerLikeShell';
import LiriConstructeurChoiceWizard from '@/components/liri-ecosystem/LiriConstructeurChoiceWizard';
import {
  CONSTRUCTEURS_CATALOG,
  CONSTRUCTEUR_PIPELINE_STEPS,
  DESIGNER_HREF,
} from '@/lib/liriConstructeursCatalog';

const AUDIT_INTRO = [
  'Référence cahier : LIRI SmartBoard Designer (vision plateforme cours + IA + design + live) ; pack Pédagogie du futur (parcours scolaire, blocs, weekly grammar).',
  'Tous les parcours convergent vers le SmartBoard Designer pour la couche graphique (slides, objets, thèmes, export, live).',
  'Cette page est une synthèse fonctionnelle : le code peut évoluer (persistance, fusions d\'outils).',
];

export default function StudioLiriConstructeursGuidePage() {
  return (
    <StudioDesignerLikeShell
      railActiveKey="constructeurs"
      pageLabel="Guide constructeurs"
      pageAccent="violet"
      TitleIcon={BookMarked}
      titleLine="Comparatif & audit"
      topBarCenter={(
        <Link
          to="/studio/liri/constructeurs"
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-white/12 px-2.5 py-1 text-[11px] font-medium text-white/55 transition-all hover:bg-white/[0.06] hover:text-white/85"
        >
          <ArrowLeft className="h-3 w-3" />
          Choix rapide
        </Link>
      )}
    >
      <div className="mx-auto max-w-4xl px-5 py-8 lg:px-8">
        <p className="mb-6 text-[13px] leading-relaxed text-white/45">
          {AUDIT_INTRO.map((p, i) => (
            <span key={i} className="block border-l-2 border-violet-500/35 pl-3 mb-2 last:mb-0">
              {p}
            </span>
          ))}
        </p>

        <div className="mb-8 rounded-2xl border border-cyan-500/20 bg-cyan-950/[0.12] px-5 py-5">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-cyan-400/90">Pipeline type</h2>
          <p className="mt-1 text-[12px] text-white/42">
            Les constructeurs ci-dessous préparent la structure et le contenu ; le{' '}
            <Link to={DESIGNER_HREF} className="text-cyan-400/90 underline-offset-2 hover:underline">
              SmartBoard Designer
            </Link>{' '}
            matérialise presque toujours l'étape visuelle avant live ou export.
          </p>
          <ol className="mt-4 space-y-3">
            {CONSTRUCTEUR_PIPELINE_STEPS.map((s) => (
              <li key={s.step} className="flex gap-3 text-[12px] leading-relaxed text-white/52">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-[11px] font-bold text-cyan-300">
                  {s.step}
                </span>
                <span>
                  <span className="font-semibold text-white/75">{s.title}</span>
                  <span className="mt-0.5 block text-white/40">{s.detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <LiriConstructeurChoiceWizard className="mb-10" />

        <div className="mb-10 overflow-x-auto rounded-xl border border-white/[0.08]">
          <table className="w-full min-w-[640px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.04]">
                <th className="px-3 py-2.5 font-semibold text-white/70">Constructeur</th>
                <th className="px-3 py-2.5 font-semibold text-white/70">Type</th>
                <th className="px-3 py-2.5 font-semibold text-white/70">Public principal</th>
                <th className="px-3 py-2.5 font-semibold text-white/70">Étape suivante</th>
              </tr>
            </thead>
            <tbody>
              {CONSTRUCTEURS_CATALOG.map((row) => (
                <tr key={row.id} className="border-b border-white/[0.06] last:border-0">
                  <td className="px-3 py-2.5">
                    <Link to={row.href} className="font-medium text-cyan-400/95 hover:underline">
                      {row.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-white/45">{row.badge}</td>
                  <td className="px-3 py-2.5 text-white/40">{row.audience[0]}</td>
                  <td className="px-3 py-2.5 text-white/38">{row.flowNext}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <nav className="mb-8 flex flex-wrap gap-2">
          {CONSTRUCTEURS_CATALOG.map((c) => (
            <a
              key={c.id}
              href={`#${c.id}`}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/50 transition-colors hover:border-violet-500/30 hover:text-white/80"
            >
              {c.title.split('(')[0].trim()}
            </a>
          ))}
        </nav>

        <div className="space-y-10">
          {CONSTRUCTEURS_CATALOG.map((c) => (
            <section
              key={c.id}
              id={c.id}
              className="scroll-mt-24 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 lg:p-6"
            >
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-[17px] font-bold text-white/92">{c.title}</h2>
                  <p className="mt-1 text-[13px] text-white/45">{c.subtitle}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {c.badge ? (
                      <span className="rounded-md border border-white/12 bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/50">
                        {c.badge}
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        'rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        c.family === 'liri'
                          ? 'border-violet-500/25 text-violet-300'
                          : 'border-amber-500/25 text-amber-300/90',
                      )}
                    >
                      {c.family === 'liri' ? 'LIRI' : 'Studio hérité'}
                    </span>
                  </div>
                </div>
                <Link
                  to={c.href}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-violet-500"
                >
                  Ouvrir l'outil
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/38">Ce qu'il configure</h3>
                  <ul className="space-y-1.5">
                    {c.configures.map((line, i) => (
                      <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-white/52">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-cyan-500/55" />
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/38">À qui s'adresse-t-il</h3>
                  <ul className="space-y-1.5">
                    {c.audience.map((line, i) => (
                      <li key={i} className="text-[13px] leading-relaxed text-white/52">
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
                  <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-400/95">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Avantages
                  </h3>
                  <ul className="space-y-1.5">
                    {c.advantages.map((line, i) => (
                      <li key={i} className="text-[12px] leading-relaxed text-white/55">
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
                  <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-400/95">
                    <XCircle className="h-3.5 w-3.5" />
                    Limites / risques
                  </h3>
                  <ul className="space-y-1.5">
                    {c.drawbacks.map((line, i) => (
                      <li key={i} className="text-[12px] leading-relaxed text-white/55">
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3">
                <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35">Lien cahier des charges & vision produit</h3>
                <p className="text-[13px] leading-relaxed text-white/48">{c.cahierDesCharges}</p>
                {c.flowNext ? (
                  <p className="mt-2 text-[12px] text-cyan-400/85">
                    Enchaînement typique : {c.flowNext}
                  </p>
                ) : null}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
          <p className="text-[12px] text-white/40">Revenir au choix guidé des outils</p>
          <Link
            to="/studio/liri/constructeurs"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-violet-400 hover:text-violet-300"
          >
            <Compass className="h-4 w-4" />
            Hub constructeurs
          </Link>
        </div>
      </div>
    </StudioDesignerLikeShell>
  );
}
