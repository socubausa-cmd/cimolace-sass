/**
 * Assistant — quel constructeur ouvrir selon l'objectif (hub /studio/liri/constructeurs).
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getConstructeurById } from '@/lib/liriConstructeursCatalog';

const PRIMARY = [
  {
    key: 'programme',
    label: 'Programme multi-semaines',
    hint: 'Bootcamp, formation certifiante, vision calendaire.',
    resultId: 'liri-formation',
    altId: 'liri-pedagogie-futur',
    altLabel: 'Si c\'est une année scolaire (semaines / jours typés), ouvrir plutôt Pédagogie du futur',
  },
  {
    key: 'cours',
    label: 'Cours unique',
    hint: 'D abord choisir le mode: assiste IA, manuel, ou mixte.',
    subStep: true,
  },
  {
    key: 'scolaire',
    label: 'Système scolaire & parcours DB',
    hint: 'École du futur : modules, semaines, blocs, replay.',
    resultId: 'liri-pedagogie-futur',
  },
  {
    key: 'video',
    label: 'À partir d\'une vidéo',
    hint: 'Transcription, segments, post-prod Netlify.',
    resultId: 'studio-course-builder',
  },
  {
    key: 'arbre',
    label: 'Arbre éditorial fin (Pro)',
    hint: 'Chapitres, sous-chapitres, segments — hors grille des 10 étapes.',
    resultId: 'studio-course-pro',
  },
];

const COURS_METHOD = [
  {
    key: 'assiste',
    label: 'Assiste IA',
    sub: 'L IA propose une structure complete de cours (10 etapes).',
    resultId: 'liri-agent',
    altId: 'liri-cours',
    altLabel: 'Si vous preferez une interface panneau/edition, ouvrez plutot Course Builder LIRI.',
  },
  {
    key: 'manuel',
    label: 'Manuel',
    sub: 'Vous construisez chaque bloc pedagogique vous-meme.',
    resultId: 'liri-cours',
  },
  {
    key: 'mixte',
    label: 'Mixte',
    sub: 'L IA propose, vous corrigez et finalisez ensuite.',
    resultId: 'liri-cours',
    altId: 'liri-agent',
    altLabel: 'Pour une generation immersive rapide, vous pouvez aussi demarrer dans Agent LIRI.',
  },
];

export default function LiriConstructeurChoiceWizard({ className }) {
  const [primaryKey, setPrimaryKey] = useState(/** @type {string | null} */ (null));
  const [coursMethodKey, setCoursMethodKey] = useState(/** @type {string | null} */ (null));

  const primary = useMemo(() => PRIMARY.find((p) => p.key === primaryKey) ?? null, [primaryKey]);
  const resolvedId = useMemo(() => {
    if (!primary) return null;
    if (primary.subStep) {
      const sub = COURS_METHOD.find((c) => c.key === coursMethodKey);
      return sub?.resultId ?? null;
    }
    return primary.resultId ?? null;
  }, [primary, coursMethodKey]);

  const entry = resolvedId ? getConstructeurById(resolvedId) : null;
  const methodEntry = primary?.subStep
    ? COURS_METHOD.find((c) => c.key === coursMethodKey) ?? null
    : null;

  const reset = () => {
    setPrimaryKey(null);
    setCoursMethodKey(null);
  };

  return (
    <div
      className={cn(
        'rounded-3xl border border-white/10 bg-[#0b1020]/90 p-5 md:p-6',
        className,
      )}
    >
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-200">
            <Sparkles className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-[14px] font-semibold text-white/95">Assistant de choix rapide</h2>
            <p className="text-[12px] text-white/50">2 decisions: objectif → mode de construction</p>
          </div>
        </div>
        {(primaryKey || coursMethodKey) ? (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 self-start rounded-lg border border-white/12 px-2.5 py-1 text-[11px] text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white/75"
          >
            <RotateCcw className="h-3 w-3" />
            Recommencer
          </button>
        ) : null}
      </div>

      {!primaryKey ? (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {PRIMARY.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPrimaryKey(p.key)}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-left transition-all hover:border-cyan-400/35 hover:bg-cyan-500/[0.07]"
            >
              <span className="text-[13px] font-semibold text-white/90">{p.label}</span>
              <span className="mt-1 block text-[11px] text-white/42">{p.hint}</span>
            </button>
          ))}
        </div>
      ) : null}

      {primaryKey && primary?.subStep && !coursMethodKey ? (
        <div className="space-y-3">
          <p className="text-[12px] text-white/50">Comment voulez-vous construire ce cours ?</p>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {COURS_METHOD.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCoursMethodKey(c.key)}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-left transition-all hover:border-cyan-400/30 hover:bg-cyan-500/[0.06]"
              >
                <span className="text-[13px] font-semibold text-white/90">{c.label}</span>
                <span className="mt-1 block text-[11px] text-white/42">{c.sub}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {entry && (!primary?.subStep || coursMethodKey) ? (
        <div className="mt-1 space-y-3">
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.08] px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300/90">Recommandation</p>
            <p className="mt-1 text-[16px] font-semibold text-white">{entry.title}</p>
            <p className="mt-1 text-[12px] text-white/55">{entry.subtitle}</p>
            {methodEntry ? (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-200/90">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Mode retenu: <strong className="text-emerald-100">{methodEntry.label}</strong>. Ensuite passez au SmartBoard Designer pour la mise en scene visuelle.
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to={entry.href}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-emerald-500"
              >
                Ouvrir
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to={`/studio/liri/constructeurs/guide#${entry.id}`}
                className="inline-flex items-center gap-1 rounded-xl border border-white/15 px-3.5 py-2 text-[12px] font-medium text-white/70 transition-colors hover:bg-white/[0.06]"
              >
                Fiche guide
              </Link>
              <Link
                to="/studio/smartboard-designer"
                className="inline-flex items-center gap-1 rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-3.5 py-2 text-[12px] font-medium text-cyan-200 transition-colors hover:bg-cyan-500/20"
              >
                Puis Designer
              </Link>
            </div>
          </div>
          {primary?.altId && primary.resultId === 'liri-formation' ? (
            <p className="text-[11px] text-white/38">
              {primary.altLabel} :{' '}
              <Link to={getConstructeurById(primary.altId)?.href ?? '#'} className="text-teal-400/90 underline-offset-2 hover:underline">
                {getConstructeurById(primary.altId)?.title}
              </Link>
            </p>
          ) : null}
          {methodEntry?.altId ? (
            <p className="text-[11px] text-white/38">
              {methodEntry.altLabel}{' '}
              <Link to={getConstructeurById(methodEntry.altId)?.href ?? '#'} className="text-cyan-400/90 underline-offset-2 hover:underline">
                {getConstructeurById(methodEntry.altId)?.title}
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
