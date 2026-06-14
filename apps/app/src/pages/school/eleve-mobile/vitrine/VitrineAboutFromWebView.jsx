import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  ProrascienceVitrineImmersiveCard,
  ProrascienceVitrineImmersiveProse,
  ProrascienceVitrineMobileSectionTitle,
} from '@/components/eleve-mobile/ProrascienceMobileVitrineShell';
import { WEB_ABOUT } from '@/data/prorascienceVitrineFromWebContent';
import { EV_MUTED } from '@/pages/school/eleve-mobile/eleveMobileScreensShared';
import { cn } from '@/lib/utils';

function Fold({ title, children, defaultOpen = false }) {
  const [o, setO] = useState(defaultOpen);
  return (
    <ProrascienceVitrineImmersiveCard className="!p-0">
      <button
        type="button"
        onClick={() => setO((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="text-[12px] font-bold text-amber-100/95">{title}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-500', o && 'rotate-180')} />
      </button>
      {o && <div className="border-t border-white/10 px-3 py-3 text-[12px] leading-relaxed text-slate-300/90">{children}</div>}
    </ProrascienceVitrineImmersiveCard>
  );
}

export function VitrineAboutFromWebView() {
  const a = WEB_ABOUT;
  return (
    <>
      <ProrascienceVitrineImmersiveCard variant="sky" className="text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500/90">{a.hero.badge}</p>
        <h2 className="mt-1 font-serif text-2xl font-bold text-white">{a.hero.titleLine1}</h2>
        <p className="bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text font-serif text-2xl font-bold text-transparent">
          {a.hero.titleGold}
        </p>
        <p className="mt-2 text-[12px] text-slate-400">{a.hero.subtitle}</p>
        <p className="mt-3 text-[13px] italic text-slate-200/90">« {a.hero.quote} »</p>
      </ProrascienceVitrineImmersiveCard>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {a.stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-white/10 bg-slate-950/60 py-2 text-center">
            <p className="text-lg font-black tabular-nums text-amber-100/90">{s.value}</p>
            <p className="text-[9px] font-semibold uppercase text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      <ProrascienceVitrineMobileSectionTitle hint={a.sectionComprendre.kicker}>
        {a.sectionComprendre.title}
      </ProrascienceVitrineMobileSectionTitle>
      <ProrascienceVitrineImmersiveProse className="mb-3">{a.sectionComprendre.lead}</ProrascienceVitrineImmersiveProse>

      <div className="grid gap-2">
        <ProrascienceVitrineImmersiveCard>
          <p className="text-[12px] font-bold text-white">Vous pratiquez... mais comprenez-vous vraiment ?</p>
          <ul className="mt-2 space-y-1 text-[12px]" style={{ color: EV_MUTED }}>
            {a.practiceItems.map((x) => (
              <li key={x} className="flex gap-1.5">
                <span className="text-emerald-400/90">·</span>
                {x}
              </li>
            ))}
          </ul>
        </ProrascienceVitrineImmersiveCard>
        <ProrascienceVitrineImmersiveCard>
          <p className="text-[12px] font-bold text-white">Mais au fond...</p>
          <ul className="mt-2 space-y-1 text-[12px]" style={{ color: EV_MUTED }}>
            {a.rootQuestions.map((x) => (
              <li key={x} className="flex gap-1.5">
                <span className="text-amber-300/90">·</span>
                {x}
              </li>
            ))}
          </ul>
        </ProrascienceVitrineImmersiveCard>
      </div>

      <div className="mt-2 grid gap-2">
        <ProrascienceVitrineImmersiveCard variant="violet" className="!py-2.5">
          <p className="text-[11px] font-bold text-white">La realite</p>
          {a.realityItems.map((x) => (
            <p key={x} className="text-[11px] text-slate-400">
              - {x}
            </p>
          ))}
        </ProrascienceVitrineImmersiveCard>
        <ProrascienceVitrineImmersiveCard variant="violet" className="!py-2.5">
          <p className="text-[11px] font-bold text-white">Consequence</p>
          <p className="text-[11px] text-slate-400">La pratique devient: {a.consequences.join(', ')}.</p>
        </ProrascienceVitrineImmersiveCard>
        <ProrascienceVitrineImmersiveCard className="!py-2.5">
          <p className="text-[11px] font-bold text-white">{a.problem.title}</p>
          <p className="text-[11px] text-slate-300/90">{a.problem.text}</p>
          <p className="mt-1 text-[11px] text-amber-300/90">{a.problem.highlight}</p>
        </ProrascienceVitrineImmersiveCard>
      </div>

      <ProrascienceVitrineMobileSectionTitle>Notre methode</ProrascienceVitrineMobileSectionTitle>
      <div className="grid grid-cols-2 gap-1.5">
        {a.methodPath.map((s) => (
          <div key={s} className="rounded-lg border border-white/10 bg-slate-950/70 py-2 text-center text-[11px] font-semibold text-white">
            {s}
          </div>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        {a.methodColumns.map((col) => (
          <ProrascienceVitrineImmersiveCard key={col.title} className="!py-2.5">
            <p className="text-[11px] font-bold text-amber-200/80">{col.title}</p>
            {col.items.map((x) => (
              <p key={x} className="text-[10px] text-slate-500">
                - {x}
              </p>
            ))}
            <p className="mt-1 text-[10px] text-amber-500/80">{col.foot}</p>
          </ProrascienceVitrineImmersiveCard>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <ProrascienceVitrineImmersiveCard>
          <p className="text-[11px] font-bold text-white">Pour qui ?</p>
          {a.targetAudience.map((x) => (
            <p key={x} className="text-[11px] text-slate-400">
              · {x}
            </p>
          ))}
        </ProrascienceVitrineImmersiveCard>
        <ProrascienceVitrineImmersiveCard>
          <p className="text-[11px] font-bold text-white">Ce que vous gagnez</p>
          {a.gains.map((x) => (
            <p key={x} className="text-[11px] text-slate-400">
              · {x}
            </p>
          ))}
        </ProrascienceVitrineImmersiveCard>
      </div>

      <p className="mt-4 text-center text-[12px] italic" style={{ color: EV_MUTED }}>
        {a.closing.quote}
      </p>
      <p className="mt-2 text-center font-serif text-base font-bold text-white">{a.closing.title}</p>

      <ProrascienceVitrineMobileSectionTitle hint="ISNA — institution">{a.mission.title}</ProrascienceVitrineMobileSectionTitle>
      <ProrascienceVitrineImmersiveProse className="mb-2 text-center !text-[12px]">{a.mission.lead}</ProrascienceVitrineImmersiveProse>
      <div className="space-y-2">
        {a.mission.values.map((v) => (
          <ProrascienceVitrineImmersiveCard key={v.title}>
            <p className="text-[12px] font-bold text-amber-100/90">{v.title}</p>
            <p className="mt-1 text-[11px] leading-relaxed" style={{ color: EV_MUTED }}>
              {v.desc}
            </p>
          </ProrascienceVitrineImmersiveCard>
        ))}
      </div>

      <ProrascienceVitrineMobileSectionTitle hint={a.whatIs.lead}>{a.whatIs.title}</ProrascienceVitrineMobileSectionTitle>
      <ProrascienceVitrineImmersiveCard>
        <p className="text-[12px] font-bold text-amber-200/90">Definition synthetique</p>
        <p className="mt-2 text-[12px] leading-relaxed" style={{ color: EV_MUTED }}>
          {a.definitionSynthese}
        </p>
      </ProrascienceVitrineImmersiveCard>

      <p className="mb-1 mt-3 text-center text-[11px] font-bold text-white">Les 3 Piliers Fondateurs</p>
      {a.pillars.map((p) => (
        <ProrascienceVitrineImmersiveCard key={p.title} className="mb-2">
          <p className="text-[13px] font-bold text-amber-100/90">{p.title}</p>
          <ul className="mt-1.5 space-y-0.5 text-[11px] text-slate-400">
            {p.points.map((x) => (
              <li key={x}>- {x}</li>
            ))}
          </ul>
        </ProrascienceVitrineImmersiveCard>
      ))}

      <p className="mb-1 mt-3 text-center text-[11px] text-red-300/90">Ce que la PRORASCIENCE n'est PAS</p>
      <div className="flex flex-wrap gap-1.5">
        {a.notProrascience.map((x) => (
          <span key={x} className="rounded-md border border-red-500/20 bg-red-500/5 px-2 py-0.5 text-[10px] text-slate-300">
            {x}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[11px] italic text-slate-400">{a.notProrascienceKey}</p>

      <Fold title="Domaines d'etude (8)">
        <ul className="space-y-2">
          {a.studyDomains.map((d) => (
            <li key={d.title} className="border-b border-white/5 pb-2 last:border-0">
              <p className="font-semibold text-white">{d.title}</p>
              <p className="text-[11px] text-slate-500">{d.definition}</p>
              <p className="text-[11px] text-slate-500">{d.study}</p>
              {d.application && <p className="text-[11px] text-amber-500/80">{d.application}</p>}
            </li>
          ))}
        </ul>
      </Fold>

      <p className="mt-3 text-center font-serif text-[12px] italic text-amber-200/80">« {a.motto} »</p>
      <div className="mt-2 space-y-1.5">
        {a.mottoSteps.map((s) => (
          <div key={s.n} className="flex gap-2 rounded-lg border border-amber-500/15 bg-amber-950/20 px-2 py-1.5">
            <span className="text-lg font-bold text-amber-600/50">{s.n}</span>
            <div>
              <p className="text-[12px] font-bold text-white">{s.title}</p>
              <p className="text-[10px] text-slate-500">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="mb-1 mt-3 text-[11px] font-bold text-white">La Methode Prorascientifique</p>
      <div className="grid grid-cols-2 gap-1.5">
        {a.methodPro.map((m) => (
          <div key={m.title} className="rounded-lg border border-white/10 bg-slate-950/80 p-2">
            <p className="text-[11px] font-bold text-amber-200/80">{m.title}</p>
            <p className="text-[10px] text-slate-500">{m.desc}</p>
          </div>
        ))}
      </div>

      <ProrascienceVitrineImmersiveCard className="mt-3" variant="default">
        <p className="text-[12px] font-bold text-white">{a.whyScience.title}</p>
        <p className="mt-1 text-[11px] text-slate-400">{a.whyScience.lead}</p>
        <ul className="mt-2 space-y-1">
          {a.whyScience.bullets.map((b) => (
            <li key={b} className="text-[11px] text-slate-300/90">
              · {b}
            </li>
          ))}
        </ul>
      </ProrascienceVitrineImmersiveCard>

      <p className="mb-1 mt-3 text-center text-[12px] font-bold text-white">{a.africa.title}</p>
      <ProrascienceVitrineImmersiveProse className="text-center !text-[12px]">{a.africa.lead}</ProrascienceVitrineImmersiveProse>
      <div className="mt-2 space-y-1.5">
        {a.africa.blocks.map((b) => (
          <div key={b.label} className="rounded-lg border border-amber-500/20 p-2 text-center">
            <p className="text-[11px] font-bold text-amber-400/90">{b.label}</p>
            <p className="text-[10px] text-slate-500">{b.text}</p>
          </div>
        ))}
      </div>
    </>
  );
}
