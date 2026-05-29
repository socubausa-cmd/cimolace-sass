import React from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Camera,
  ChevronDown,
  ChevronRight,
  ChevronsLeftRight,
  Image as ImageIcon,
  ImagePlus,
  LayoutGrid,
  MessageSquare,
  Mic,
  Monitor,
  MoreVertical,
  Palette,
  PenTool,
  Plus,
  UserCircle2,
  Hand,
  UserPlus,
  Wand2,
  Video,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LiriWordmark } from '@/components/brand/LiriWordmark';

function PlaceholderCard({ host = false, title = 'Place vide' }) {
  return (
    <div className="relative h-32 min-w-[120px] overflow-hidden rounded-2xl border border-amber-400/20 bg-[linear-gradient(180deg,rgba(18,20,45,.95),rgba(10,12,28,.95))] shadow-[inset_0_0_0_1px_rgba(255,255,255,.03)]">
      {host ? (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,203,120,.14),transparent_25%),radial-gradient(circle_at_70%_30%,rgba(124,58,237,.2),transparent_30%)]" />
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-amber-200/10 to-transparent" />
          <div className="absolute left-3 top-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(135deg,#24284e,#171a37)]">
            <div className="h-full w-full bg-[radial-gradient(circle_at_60%_35%,rgba(255,215,170,.35),transparent_22%),radial-gradient(circle_at_40%_75%,rgba(255,255,255,.05),transparent_30%),linear-gradient(135deg,#273058,#121629)]" />
          </div>
          <div className="absolute bottom-8 left-3 rounded-lg bg-violet-600/70 px-2 py-1 text-[10px] font-medium text-white">HÔTE</div>
          <div className="absolute bottom-3 left-3 text-sm text-white">Prof. LIRI</div>
          <div className="absolute bottom-4 right-3 h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,.8)]" />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(255,255,255,.03),transparent_25%)]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-full border border-white/5 bg-white/[0.03] p-5">
              <UserCircle2 className="h-8 w-8 text-white/30" />
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-3 text-center text-sm text-white/80">{title}</div>
        </>
      )}
    </div>
  );
}

function LeftPanel({ title, count, icon, heading, body }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(9,11,28,.95),rgba(7,9,22,.95))] px-5 py-5 shadow-[0_0_35px_rgba(0,0,0,.35),inset_0_0_0_1px_rgba(255,255,255,.02)]">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[28px] font-medium tracking-wide text-white">
          <span className="text-[34px] leading-none">{title}</span>
          <span className="rounded-full bg-white/8 px-2.5 py-0.5 text-base text-white/70">{count}</span>
        </div>
        <button
          type="button"
          className="flex items-center gap-1 text-base text-violet-200/80 transition hover:text-white"
        >
          Voir tout <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col items-center text-center">
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-amber-400/40 bg-white/[0.02] shadow-[0_0_30px_rgba(245,158,11,.08)]">
          {icon}
        </div>
        <div className="mb-2 text-[19px] font-medium text-white">{heading}</div>
        <div className="max-w-[220px] text-[18px] leading-8 text-white/65">{body}</div>
        <button
          type="button"
          className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-3 text-lg text-white/85 transition hover:bg-white/[0.06]"
        >
          Voir tout <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function ToolButton({ icon, label, active = false }) {
  return (
    <button
      type="button"
      className={cn(
        'flex h-24 w-[106px] flex-shrink-0 flex-col items-center justify-center gap-3 rounded-2xl border transition',
        active
          ? 'border-violet-300/30 bg-violet-500/15 text-white shadow-[0_0_20px_rgba(139,92,246,.16)]'
          : 'border-white/10 bg-[linear-gradient(180deg,rgba(18,20,45,.9),rgba(10,12,28,.95))] text-white/92 hover:bg-white/[0.04]',
      )}
    >
      <div className="text-violet-100">{icon}</div>
      <span className="text-lg font-medium">{label}</span>
    </button>
  );
}

function RightCard({ title, children }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(9,11,28,.96),rgba(7,9,22,.96))] p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,.02)]">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3 text-[17px] font-semibold uppercase tracking-[0.08em] text-white">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-violet-300/20 bg-violet-500/15 text-violet-200">
            <ChevronsLeftRight className="h-4 w-4" />
          </span>
          {title}
        </div>
        <ChevronDown className="h-4 w-4 text-white/50" />
      </div>
      {children}
    </div>
  );
}

/**
 * Maquette statique vue hôte LIRI (empty state) — référence pixel / hiérarchie typographique.
 */
export default function LiriHostEmptyStateUI() {
  return (
    <div className="min-h-screen w-full bg-[#050816] text-white">
      {import.meta.env.DEV ? (
        <div className="fixed left-3 top-3 z-[300] rounded-lg border border-white/15 bg-black/60 px-2.5 py-1 text-[10px] text-white/80 backdrop-blur-md">
          <span className="font-mono text-white/90">/dev/liri-host-ui</span>
          {' · '}
          <Link to="/dev/liri-host-shell" className="text-amber-200/90 underline-offset-2 hover:underline">
            shell interactif
          </Link>
          {' · '}
          <Link to="/dev/liri-mobile-guest" className="text-amber-200/90 underline-offset-2 hover:underline">
            invité mobile
          </Link>
        </div>
      ) : null}
      <div className="min-h-screen bg-[radial-gradient(circle_at_50%_75%,rgba(251,191,36,.12),transparent_22%),radial-gradient(circle_at_67%_33%,rgba(168,85,247,.13),transparent_25%),linear-gradient(180deg,#050816_0%,#060818_40%,#07091b_100%)] p-4 md:p-5">
        <div className="grid min-h-[calc(100vh-2rem)] grid-cols-1 grid-rows-[auto_minmax(0,1fr)_auto] gap-4 lg:grid-cols-[270px_minmax(0,1fr)_240px] lg:grid-rows-[140px_minmax(0,1fr)_86px]">
          <aside className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,10,24,.95),rgba(5,7,19,.98))] p-5 shadow-[0_0_45px_rgba(0,0,0,.35)] lg:row-span-3">
            <div className="mb-6 rounded-[24px] border border-white/6 bg-[linear-gradient(180deg,rgba(18,20,45,.65),rgba(10,12,28,.2))] p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="relative h-16 w-16 rounded-full border border-violet-300/20 bg-[radial-gradient(circle_at_35%_35%,rgba(255,255,255,.4),transparent_8%),radial-gradient(circle_at_50%_50%,rgba(109,40,217,.35),transparent_55%),linear-gradient(135deg,#21315e,#0d1127)]">
                  <div className="absolute inset-2 rounded-full border border-amber-300/20" />
                </div>
                <LiriWordmark size="billboard" className="text-[#e5c47a]" />
              </div>
              <div className="mt-5 flex items-center gap-3 text-[24px] font-medium text-[#ffcf84]">
                <span className="h-3.5 w-3.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,.8)]" />
                ÉVÉNEMENTS EN DIRECT
              </div>
            </div>

            <div className="space-y-4">
              <LeftPanel
                title="MAINS LEVÉES"
                count={0}
                icon={<Hand className="h-9 w-9 text-amber-300" />}
                heading="Aucune main levée"
                body="Lorsque des élèves lèveront la main, ils apparaîtront ici."
              />
              <LeftPanel
                title="SALLE D'ATTENTE"
                count={0}
                icon={<UserPlus className="h-9 w-9 text-sky-300" />}
                heading="Aucun membre en attente."
                body="Les demandes pour rejoindre apparaîtront ici."
              />
              <LeftPanel
                title="NOTIFICATIONS"
                count={0}
                icon={<Bell className="h-9 w-9 text-amber-200" />}
                heading="Pas de nouvelle notification."
                body="Les activités en temps réel s'afficheront ici."
              />
            </div>
          </aside>

          <div className="overflow-hidden rounded-[28px] border border-amber-400/20 bg-[linear-gradient(180deg,rgba(10,11,26,.98),rgba(8,9,22,.98))] px-3 py-3 shadow-[0_0_40px_rgba(0,0,0,.28)] lg:col-start-2 lg:row-start-1">
            <div className="no-scrollbar flex h-full gap-3 overflow-x-auto">
              <PlaceholderCard host />
              {Array.from({ length: 8 }).map((_, i) => (
                <PlaceholderCard key={i} title="Place vide" />
              ))}
            </div>
          </div>

          <main className="rounded-[30px] border border-amber-400/20 bg-[linear-gradient(180deg,rgba(10,11,28,.98),rgba(7,9,22,.98))] p-2 shadow-[0_0_45px_rgba(0,0,0,.35)] lg:col-start-2 lg:row-start-2 lg:min-h-0">
            <div className="flex h-full min-h-[280px] flex-col overflow-hidden rounded-[26px] border border-white/6 bg-[linear-gradient(180deg,rgba(12,14,35,.96),rgba(7,9,22,.96))] lg:min-h-0">
              <div className="flex flex-wrap items-center justify-center gap-4 border-b border-white/6 py-4">
                <div className="h-10 w-10 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,.35),transparent_10%),linear-gradient(135deg,#f5d67f,#8b5cf6,#38bdf8)] shadow-[0_0_20px_rgba(251,191,36,.2)]" />
                <LiriWordmark size="stage" className="text-[#e5c47a]" />
                <div className="text-[clamp(1rem,2.5vw,26px)] tracking-[0.35em] text-white/80">COGNITIVE ENGINE</div>
                <LayoutGrid className="h-6 w-6 text-white/45" />
              </div>

              <div className="min-h-[120px] flex-1 bg-[radial-gradient(circle_at_30%_30%,rgba(94,64,255,.06),transparent_20%),radial-gradient(circle_at_78%_55%,rgba(255,147,87,.16),transparent_25%),linear-gradient(180deg,#101327_0%,#0b0f22_100%)] lg:min-h-0" />

              <div className="border-t border-white/6 p-3">
                <div className="no-scrollbar flex items-center gap-3 overflow-x-auto">
                  <ToolButton active icon={<LayoutGrid className="h-8 w-8" />} label="SmartBoard" />
                  <ToolButton icon={<Monitor className="h-8 w-8" />} label="Diapo" />
                  <ToolButton icon={<ImageIcon className="h-8 w-8" />} label="Web" />
                  <ToolButton icon={<Plus className="h-8 w-8" />} label="Embed" />
                  <ToolButton icon={<Monitor className="h-8 w-8" />} label="Écran" />
                  <ToolButton icon={<Palette className="h-8 w-8" />} label="Ecran" />
                  <ToolButton icon={<PenTool className="h-8 w-8" />} label="Crayon" />
                  <ToolButton icon={<ImagePlus className="h-8 w-8" />} label="Images" />
                  <ToolButton icon={<Camera className="h-8 w-8" />} label="Cam 2" />
                  <ToolButton icon={<Palette className="h-8 w-8" />} label="Boutique" />
                  <button
                    type="button"
                    className="ml-auto flex h-24 w-20 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(18,20,45,.9),rgba(10,12,28,.95))] text-white/80 hover:bg-white/[0.04]"
                  >
                    <ChevronDown className="h-6 w-6" />
                  </button>
                </div>
              </div>
            </div>
          </main>

          <aside className="flex flex-col gap-4 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,10,24,.98),rgba(5,7,19,.98))] p-3 shadow-[0_0_45px_rgba(0,0,0,.35)] lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:min-h-0 lg:overflow-y-auto">
            <div className="rounded-[24px] border border-amber-400/25 bg-[linear-gradient(180deg,rgba(25,18,23,.9),rgba(13,14,31,.98))] p-3 shadow-[0_0_24px_rgba(245,158,11,.12)]">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[20px] font-medium tracking-[0.04em] text-[#e9bf72]">HÔTE EN DIRECT</div>
                <span className="rounded-lg bg-red-500/80 px-2 py-1 text-sm font-medium text-white">LIVE</span>
              </div>
              <div className="h-52 rounded-[18px] border border-white/8 bg-[radial-gradient(circle_at_70%_20%,rgba(255,201,148,.22),transparent_20%),linear-gradient(135deg,#262f5b,#151830)]" />
              <div className="mt-3 flex gap-2">
                <button type="button" className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-white/90">
                  <Mic className="h-5 w-5" />
                </button>
                <button type="button" className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-white/90">
                  <Video className="h-5 w-5" />
                </button>
                <button type="button" className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-white/90">
                  <MoreVertical className="h-5 w-5" />
                </button>
              </div>
            </div>

            <RightCard title="Mindmap">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="mx-auto mb-4 w-fit rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2 text-base text-white/90">IDÉE CENTRALE</div>
                <div className="mx-auto mb-3 w-fit rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2 text-base text-white/90">Chapitre 1</div>
                <div className="flex flex-wrap items-center justify-center gap-6 text-base text-white/90 sm:gap-10">
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2">Chapitre 1</div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2">Chapitre 2</div>
                </div>
                <button
                  type="button"
                  className="mt-5 w-full rounded-2xl border border-white/10 bg-white/[0.03] py-3 text-lg text-white/85 hover:bg-white/[0.06]"
                >
                  Voir tout le plan
                </button>
              </div>
            </RightCard>

            <RightCard title="Masterscript">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-[19px] text-white/72">
                Aucune recommandation
              </div>
            </RightCard>

            <RightCard title="Script à dire">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-[19px] text-white/72">
                Aucun script de cours généré
              </div>
            </RightCard>
          </aside>

          <footer className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,11,26,.98),rgba(8,9,22,.98))] p-3 shadow-[0_0_35px_rgba(0,0,0,.32)] lg:col-start-2 lg:row-start-3">
            <div className="flex h-full flex-wrap items-center gap-2 md:gap-3">
              <button type="button" className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-white/90">
                <Mic className="h-6 w-6" />
              </button>
              <button type="button" className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-white/90">
                <Video className="h-6 w-6" />
              </button>
              <button type="button" className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-white/90">
                <Wand2 className="h-6 w-6" />
              </button>
              <button type="button" className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-white/90">
                <LayoutGrid className="h-6 w-6" />
              </button>
              <button type="button" className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-white/90">
                <MessageSquare className="h-6 w-6" />
              </button>

              <div className="mx-1 hidden h-9 w-px bg-white/10 sm:block" />

              <div className="min-w-[12rem] flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-[19px] text-white/45">
                Écrire une question ou une instruction...
              </div>

              <button type="button" className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[24px] text-white/90">
                ‹
              </button>
              <div className="text-[32px] tracking-[0.12em] text-white">04/04</div>
              <button type="button" className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-white/90">
                <Mic className="h-6 w-6" />
              </button>
              <button
                type="button"
                className="rounded-[20px] bg-[#c63b3b] px-6 py-3 text-[clamp(1.25rem,3vw,38px)] font-medium tracking-[0.04em] text-white shadow-[0_0_20px_rgba(198,59,59,.35)] md:px-8 md:py-4"
              >
                STOP
              </button>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
