import React from 'react';
import {
  Activity,
  Bell,
  BookOpen,
  Bot,
  Brain,
  CheckCircle2,
  Circle,
  Clock3,
  Download,
  FolderKanban,
  Gauge,
  Layers,
  Library,
  ListChecks,
  MoreVertical,
  Palette,
  PanelLeftClose,
  Presentation,
  Settings,
  Sparkles,
} from 'lucide-react';

export default function OrchestratorLivePage() {
  const now = new Date().toLocaleTimeString();
  const completion = 62;

  const agents = [
    { name: 'Masterclass Coach', role: 'Analyse & Pédagogie', progress: 75, state: 'RUNNING', task: 'Construction du chapitre 3', jobs: 12, errors: 0, remain: '2.1 min', color: 'from-violet-500 to-fuchsia-400' },
    { name: 'Visual Director', role: 'Direction Artistique', progress: 45, state: 'RUNNING', task: 'Visual map chapitre 2', jobs: 6, errors: 0, remain: '3.4 min', color: 'from-cyan-500 to-sky-400' },
    { name: 'SmartBoard Architect', role: 'Slides Intelligents', progress: 30, state: 'RUNNING', task: 'Slide tension pédagogique', jobs: 9, errors: 1, remain: '4.7 min', color: 'from-amber-500 to-orange-400' },
    { name: 'Quality Agent', role: 'Validation Qualité', progress: 0, state: 'IDLE', task: 'En attente de slides', jobs: 4, errors: 0, remain: '—', color: 'from-emerald-500 to-teal-400' },
  ];

  const pipeline = [
    ['Texte brut', BookOpen, 'Terminé'],
    ['Analyse', Brain, 'Terminé'],
    ['Chapitres', ListChecks, 'Terminé'],
    ['Visual Map', Palette, 'En cours'],
    ['Slides', Presentation, 'En cours'],
    ['Quality', CheckCircle2, 'En attente'],
    ['Export', Download, 'En attente'],
  ] as const;

  const chapterRows = [
    ['01', 'La protection commence parle transfert de conscience', 'SMARTBOARD GENERATING', '62%', '12 / 19', '9', '7'],
    ['02', 'La somnolence, porte du monde spirituel', 'VISUAL MAPPED', '35%', '4 / 19', '2', '15'],
    ['03', 'Le monde du milieu: firmament et Katiokeni', 'STRUCTURED', '18%', '0 / 19', '0', '19'],
    ['04', 'Les portes du monde d’en bas', 'DRAFT', '0%', '0 / 19', '0', '19'],
  ];

  const logs = [
    'Masterclass Coach démarre l’analyse du texte source.',
    '2 chapitres prêts pour Visual Director.',
    'Visual Director prépare la visual map du chapitre 2.',
    'SmartBoard Architect génère slide par slide.',
    'Quality Agent a validé 9 slides du chapitre 1.',
    'Pipeline parallèle activé pour accélérer le traitement.',
    'Chapitre 1: 12 slides générées.',
    'Quality Agent démarre la validation automatique.',
  ];

  return (
    <main className="h-[100dvh] overflow-hidden bg-[#030711] text-white">
      <div className="h-[100dvh] overflow-hidden bg-[radial-gradient(60%_40%_at_50%_0%,rgba(124,58,237,0.28),transparent_70%),radial-gradient(30%_35%_at_90%_80%,rgba(6,182,212,0.14),transparent_75%),linear-gradient(180deg,#060d1d,#040812)] p-3">
        <div className="flex h-[calc(100dvh-24px)] overflow-hidden rounded-[22px] border border-white/10 bg-[#050914]/60 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.95)]">
          <aside className="flex h-full w-[230px] flex-col border-r border-white/10 bg-[#050a16]/92 p-3.5 backdrop-blur-xl">
            <div className="mb-6 flex items-center gap-2.5 px-1">
              <div className="rounded-lg bg-violet-500/20 p-2 text-violet-200 shadow-[0_0_20px_-8px_rgba(139,92,246,0.9)]">
                <Sparkles size={14} />
              </div>
              <p className="text-[31px] font-black tracking-tight">LIRI</p>
            </div>
            <div className="space-y-1.5">
              <NavItem label="Orchestrateur Live" icon={Activity} active />
              <NavItem label="SmartBoard Stream" icon={BookOpen} />
              <NavItem label="Projets" icon={FolderKanban} />
              <NavItem label="Bibliothèque" icon={Library} />
              <NavItem label="Agents" icon={Bot} />
              <NavItem label="Paramètres" icon={Settings} />
              <NavItem label="Logs système" icon={ListChecks} />
            </div>
            <div className="mt-7 rounded-2xl border border-violet-400/25 bg-violet-500/10 p-3">
              <p className="text-[10px] text-white/55">Projet actif</p>
              <div className="mt-2 rounded-xl border border-violet-300/20 bg-black/25 p-2.5">
                <div className="mb-2 h-12 rounded-lg border border-violet-300/15 bg-[radial-gradient(70%_70%_at_30%_30%,rgba(139,92,246,0.5),rgba(0,0,0,0))]" />
                <p className="text-xs font-semibold">demo_masterclass</p>
                <p className="mt-1 text-[10px] text-emerald-300">● En cours</p>
              </div>
            </div>
            <div className="mt-auto rounded-2xl border border-white/10 bg-black/25 p-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-violet-500/30" />
                <div>
                  <p className="text-xs font-semibold">Coach LIRI</p>
                  <p className="text-[10px] text-emerald-300">● En ligne</p>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-white/35">LIRI Orchestrator v1.0.0</p>
            </div>
          </aside>

          <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden p-3.5">
            <header className="mb-3 flex items-center justify-between rounded-[16px] border border-white/10 bg-[#060c1a]/90 px-4 py-3">
              <div>
                <p className="text-[37px] font-black leading-none tracking-tight">LIRI Orchestrator Live</p>
                <p className="mt-1 text-[12px] text-white/55">Orchestration temps réel des agents IA</p>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="rounded-full border border-emerald-400/30 bg-emerald-500/12 px-3 py-1 text-[11px] text-emerald-200">● Système actif</span>
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm">{now}</div>
                <button className="rounded-lg border border-white/10 bg-white/5 p-2"><Bell size={14} /></button>
                <button className="rounded-lg border border-white/10 bg-white/5 p-2"><Gauge size={14} /></button>
                <button className="rounded-lg border border-white/10 bg-white/5 p-2"><PanelLeftClose size={14} /></button>
              </div>
            </header>

            <div className="mb-3 grid shrink-0 grid-cols-4 gap-3">
              {agents.map((agent) => (
                <div key={agent.name} className="rounded-2xl border border-white/10 bg-[#0a1022]/90 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <p className="text-[24px] font-bold leading-tight">{agent.name}</p>
                      <p className="text-[11px] text-white/50">{agent.role}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${agent.state === 'RUNNING' ? 'bg-emerald-500/18 text-emerald-200' : 'bg-white/10 text-white/60'}`}>{agent.state}</span>
                      <MoreVertical size={13} className="text-white/45" />
                    </div>
                  </div>
                  <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className={`h-full rounded-full bg-gradient-to-r ${agent.color}`} style={{ width: `${agent.progress}%` }} />
                  </div>
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-white/70">{agent.task}</span>
                    <span className="text-2xl font-black leading-none">{agent.progress}%</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <MiniMetric value={String(agent.jobs)} label="Jobs" />
                    <MiniMetric value={String(agent.errors)} label="Erreurs" />
                    <MiniMetric value={agent.remain} label="Restant" />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-[1.58fr_0.92fr_1fr] gap-3 overflow-hidden">
              <section className="min-h-0 space-y-3 overflow-hidden">
                <div className="rounded-[18px] border border-white/10 bg-[#0b1020]/90 p-3.5">
                  <p className="mb-3 text-sm font-bold text-white/85">PIPELINE GLOBAL</p>
                  <div className="grid grid-cols-7 gap-1.5">
                    {pipeline.map(([label, Icon, tag], idx) => (
                      <div key={String(label)} className="text-center">
                        <div className={`mx-auto mb-1.5 flex h-11 w-11 items-center justify-center rounded-full border ${idx <= 4 ? 'border-violet-400/35 bg-violet-500/12 text-violet-200' : 'border-white/20 bg-white/5 text-white/50'}`}>
                          <Icon size={16} />
                        </div>
                        <p className="text-[10px] font-medium">{String(label)}</p>
                        <p className="mt-0.5 text-[9px] text-white/45">{String(tag)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 h-9 rounded-lg border border-violet-400/20 bg-[radial-gradient(80%_80%_at_50%_0%,rgba(139,92,246,0.32),transparent_70%)]" />
                </div>
                <div className="min-h-0 rounded-[18px] border border-white/10 bg-[#0b1020]/90 p-3.5">
                  <p className="mb-2.5 text-sm font-bold text-white/85">PROGRESSION PAR CHAPITRE</p>
                  <div className="max-h-[24vh] space-y-2 overflow-y-auto pr-1">
                    {chapterRows.map((row) => (
                      <div key={row[0]} className="rounded-xl border border-white/10 bg-black/25 p-2.5">
                        <div className="mb-1 flex items-center justify-between">
                          <p className="text-xs font-semibold">{row[0]} · {row[1]}</p>
                          <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[9px] text-violet-200">{row[2]}</span>
                        </div>
                        <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-400" style={{ width: row[3] }} />
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-[10px] text-white/60">
                          <span>{row[3]}</span>
                          <span>{row[4]}</span>
                          <span>{row[5]}</span>
                          <span>{row[6]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="min-h-0 space-y-3 overflow-hidden">
                <div className="rounded-[18px] border border-white/10 bg-[#0b1020]/90 p-4">
                  <p className="text-xs text-white/55">PROGRESSION GLOBALE</p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="relative h-24 w-24 rounded-full border-4 border-violet-500/30 shadow-[0_0_22px_-10px_rgba(124,58,237,0.9)]">
                      <div className="absolute inset-0 rounded-full border-4 border-cyan-300" style={{ clipPath: `inset(${100 - completion}% 0 0 0)` }} />
                      <div className="absolute inset-0 flex items-center justify-center text-xl font-black">{completion}%</div>
                    </div>
                    <div className="space-y-1 text-[12px] text-white/70">
                      <p>Chapitres créés: <span className="font-bold text-white">8 / 12</span></p>
                      <p>Slides générés: <span className="font-bold text-white">96 / 228</span></p>
                      <p>Slides validés: <span className="font-bold text-white">71 / 228</span></p>
                      <p>Temps estimé: <span className="font-bold text-white">~ 8 min</span></p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Stat icon={BookOpen} value="8 / 12" label="Chapitres créés" />
                  <Stat icon={Layers} value="96 / 228" label="Slides générés" />
                  <Stat icon={CheckCircle2} value="71 / 228" label="Slides validés" />
                  <Stat icon={Clock3} value="93%" label="Taux réussite" />
                </div>
              </section>

              <aside className="min-h-0 space-y-3 overflow-hidden">
                <div className="min-h-0 rounded-[18px] border border-white/10 bg-[#0b1020]/90 p-3.5">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-bold">LOGS LIVE</p>
                    <button className="text-[11px] text-white/55">Voir tout</button>
                  </div>
                  <div className="max-h-[26vh] space-y-1.5 overflow-y-auto pr-1 text-[11px]">
                    {logs.map((line, i) => (
                      <p key={`${line}-${i}`} className="rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-white/70">
                        <span className="mr-1 text-violet-300">•</span>{line}
                      </p>
                    ))}
                  </div>
                </div>
                <div className="rounded-[18px] border border-white/10 bg-[#0b1020]/90 p-3.5">
                  <p className="mb-2 text-sm font-bold">ACTIVITÉ EN TEMPS RÉEL</p>
                  <div className="relative h-44 rounded-xl border border-violet-400/20 bg-[radial-gradient(circle_at_50%_45%,rgba(124,58,237,0.35),transparent_45%)]">
                    <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-violet-300/35 bg-violet-500/20" />
                    <div className="absolute inset-4 rounded-full border border-cyan-400/25" />
                    <div className="absolute inset-10 rounded-full border border-amber-400/25" />
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] text-white/60">
                      <span className="flex items-center gap-1"><Circle size={8} className="fill-violet-400 text-violet-400" />Coach</span>
                      <span className="flex items-center gap-1"><Circle size={8} className="fill-cyan-400 text-cyan-400" />Visual</span>
                      <span className="flex items-center gap-1"><Circle size={8} className="fill-amber-400 text-amber-400" />Architect</span>
                      <span className="flex items-center gap-1"><Circle size={8} className="fill-emerald-400 text-emerald-400" />Quality</span>
                    </div>
                  </div>
                </div>
              </aside>
            </div>

            <div className="mt-3 flex shrink-0 items-center justify-between rounded-[16px] border border-white/10 bg-black/25 px-5 py-2.5 text-sm text-white/70">
              <div className="flex items-center gap-2">
                <Clock3 size={16} />
                <span>Pipeline parallèle activé</span>
              </div>
              <div className="flex items-center gap-4 text-[12px]">
                <span className="text-emerald-300">● API Connectée</span>
                <span className="text-cyan-300">● WebSocket Live</span>
                <button className="rounded-xl border border-white/15 bg-white/5 px-3 py-1 text-white/85">Exporter le projet</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function NavItem({ label, icon: Icon, active = false }: { label: string; icon: any; active?: boolean }) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left ${
        active
          ? 'border-violet-400/40 bg-violet-500/20 text-violet-100'
          : 'border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.07]'
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function Stat({ icon: Icon, value, label }: { icon: any; value: string; label: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3.5">
      <Icon className="mb-2 text-violet-300" size={16} />
      <p className="text-2xl font-black">{value}</p>
      <p className="text-[11px] text-white/45">{label}</p>
    </div>
  );
}

function MiniMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
      <p className="font-semibold text-white">{value}</p>
      <p className="text-[10px] text-white/45">{label}</p>
    </div>
  );
}
