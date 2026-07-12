import React, { useMemo } from 'react';
import { motion, MotionConfig } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  BookOpen,
  Layers,
  CalendarDays,
  PlayCircle,
  Users,
  Video,
  Presentation,
  ChevronLeft,
  ExternalLink,
  Edit,
  CheckCircle2,
} from 'lucide-react';
import FormationStatistics from './FormationStatistics';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ── Langage visuel LIRI (chaud) : accent = token tenant --school-accent (coral) ──
// Plus de navy en dur (#0F1419/#151a21) qui jurait avec la coque chaude du portail :
// surfaces neutres chaudes + filets, aucune carte imbriquée, l'accent porte le sens.
const A = 'var(--school-accent)';
const soft = (p) => `color-mix(in srgb, var(--school-accent) ${p}%, transparent)`;
const C = {
  ink: '#f5f1e9',
  ink2: 'rgba(245,241,233,0.62)',
  ink3: 'rgba(245,241,233,0.40)',
  ink4: 'rgba(245,241,233,0.20)',
  line: 'rgba(245,241,233,0.10)',
  lineSoft: 'rgba(245,241,233,0.06)',
  raise: 'rgba(245,241,233,0.035)',
  raiseHover: 'rgba(245,241,233,0.07)',
  success: '#6cc08b',
  warn: '#e0a458',
};

const getAccessLabel = (formation) => {
  const mode = formation?.access_mode || formation?.meta?.access_mode || formation?.meta?.access?.mode || 'free';
  if (mode === 'subscription') return 'Abonnement';
  if (mode === 'one_time') return 'Vente module';
  return 'Gratuit';
};

const STATUS_META = {
  published: { label: 'Publié', color: C.success, bg: 'rgba(108,192,139,0.14)' },
  draft: { label: 'Brouillon', color: C.warn, bg: 'rgba(224,164,88,0.14)' },
  archived: { label: 'Archivé', color: C.ink3, bg: 'rgba(245,241,233,0.06)' },
};

const s = (n) => (n > 1 ? 's' : '');

// ── Compteur méta (icône + valeur + libellé), aligné à gauche ────────────────────
function Stat({ icon: Icon, value, label }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ background: soft(12), color: A }}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-bold" style={{ color: C.ink }}>{value}</span>
        <span className="block text-[11px] font-medium uppercase tracking-wide" style={{ color: C.ink3 }}>{label}</span>
      </span>
    </div>
  );
}

// ── État vide sobre (pas d'espace mort : un message centré, discret) ──────────────
function Empty({ icon: Icon, title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: soft(10), color: A }}>
        <Icon className="h-6 w-6" />
      </span>
      <p className="text-sm font-semibold" style={{ color: C.ink }}>{title}</p>
      {hint && <p className="mt-1 max-w-sm text-xs" style={{ color: C.ink3 }}>{hint}</p>}
    </div>
  );
}

// ── Onglet minimal (soulignement coral, pas de pilule pleine) ────────────────────
const tabCls =
  'relative rounded-none border-b-2 border-transparent bg-transparent px-1 pb-3 pt-0 text-[13px] font-semibold shadow-none ' +
  'text-[color:var(--tab-idle)] transition-colors data-[state=active]:border-[color:var(--school-accent)] ' +
  'data-[state=active]:bg-transparent data-[state=active]:shadow-none ' +
  'data-[state=active]:text-[color:var(--tab-active)] data-[state=inactive]:hover:text-[color:var(--tab-active)]';

const FormationDetailsPageView = ({ formation, onBack, onEdit, onPreview, isEditLoading, isPreviewLoading }) => {
  const modules = formation?.modules ?? [];
  const students = formation?.enrolledStudents ?? [];

  const { weeksCount, lessonsCount } = useMemo(() => {
    let w = 0;
    let l = 0;
    for (const m of modules) {
      const ws = m.weeks || [];
      w += ws.length;
      for (const wk of ws) l += (wk.days || []).length;
    }
    return { weeksCount: w, lessonsCount: l };
  }, [modules]);

  if (!formation) return null;

  const hasThumb = Boolean(formation.thumbnail);
  const status = STATUS_META[formation.status] || STATUS_META.draft;

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="relative min-h-full"
        style={{ color: C.ink, '--tab-idle': C.ink3, '--tab-active': C.ink }}
      >
        {/* Ambiance chaude — halo coral discret, aucun bleu froid */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div
            className="absolute -top-24 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full blur-[130px]"
            style={{ background: soft(9) }}
          />
          <div
            className="absolute bottom-0 right-[6%] h-[280px] w-[280px] rounded-full blur-[120px]"
            style={{ background: 'rgba(224,164,88,0.05)' }}
          />
        </div>

        <div className="mx-auto w-full max-w-5xl px-5 pb-24 pt-2">
          {/* Retour */}
          <button
            onClick={onBack}
            className="group inline-flex items-center gap-1.5 py-2 text-sm font-medium transition-colors"
            style={{ color: C.ink3 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = C.ink; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = C.ink3; }}
          >
            <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            Retour aux formations
          </button>

          {/* ── Hero : composition horizontale, sans carte ─────────────────────── */}
          <motion.header
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="mt-5 flex flex-col gap-7 md:flex-row md:items-stretch md:gap-8"
          >
            {/* Média / emblème — jamais une zone grise vide */}
            <div
              className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-2xl md:aspect-auto md:w-[272px]"
              style={{
                border: `1px solid ${C.line}`,
                background: hasThumb
                  ? '#171411'
                  : `radial-gradient(130% 100% at 50% 0%, ${soft(24)}, transparent 62%), #1a1714`,
              }}
            >
              {hasThumb ? (
                <img src={formation.thumbnail} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
                  <span
                    className="flex h-16 w-16 items-center justify-center rounded-2xl"
                    style={{ background: soft(16), color: A, boxShadow: `0 0 48px ${soft(26)}` }}
                  >
                    <BookOpen className="h-7 w-7" />
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: C.ink3 }}>
                    {formation.year || 'Formation'}
                  </span>
                </div>
              )}
            </div>

            {/* Infos */}
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="rounded-full px-3 py-1 text-[11px] font-bold"
                  style={{ background: status.bg, color: status.color }}
                >
                  {status.label}
                </span>
                <span
                  className="rounded-full px-3 py-1 text-[11px] font-bold"
                  style={{ background: soft(14), color: A, border: `1px solid ${soft(30)}` }}
                >
                  {getAccessLabel(formation)}
                </span>
                {formation.year && !hasThumb ? null : formation.year ? (
                  <span className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: C.raise, color: C.ink2 }}>
                    {formation.year}
                  </span>
                ) : null}
              </div>

              <h1
                className="mt-4 font-serif text-3xl font-bold leading-[1.08] md:text-[40px]"
                style={{ color: C.ink, textWrap: 'balance', letterSpacing: '-0.02em' }}
              >
                {formation.title}
              </h1>

              {formation.description && (
                <p className="mt-3 max-w-2xl text-[15px] leading-relaxed" style={{ color: C.ink2, textWrap: 'pretty' }}>
                  {formation.description}
                </p>
              )}

              {/* Bande de compteurs — donne du corps au hero */}
              <div className="mt-6 flex flex-wrap items-center gap-x-7 gap-y-4">
                <Stat icon={Layers} value={modules.length} label={`Module${s(modules.length)}`} />
                <Stat icon={CalendarDays} value={weeksCount} label={`Semaine${s(weeksCount)}`} />
                <Stat icon={PlayCircle} value={lessonsCount} label={`Leçon${s(lessonsCount)}`} />
                <Stat icon={Users} value={students.length} label={`Étudiant${s(students.length)}`} />
              </div>

              {/* Actions */}
              <div className="mt-auto flex flex-wrap gap-3 pt-8">
                <button
                  onClick={onPreview}
                  disabled={isPreviewLoading}
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition-transform active:scale-[0.99] disabled:opacity-60"
                  style={{ background: A, color: '#1c1a17', boxShadow: `0 12px 34px ${soft(30)}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.06)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
                >
                  <ExternalLink className="h-[18px] w-[18px]" />
                  {isPreviewLoading ? 'Chargement…' : 'Aperçu'}
                </button>
                <button
                  onClick={onEdit}
                  disabled={isEditLoading}
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-colors disabled:opacity-60"
                  style={{ border: `1px solid ${C.line}`, color: C.ink }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.raise; e.currentTarget.style.borderColor = soft(34); }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = C.line; }}
                >
                  <Edit className="h-[18px] w-[18px]" />
                  {isEditLoading ? 'Chargement…' : 'Éditer'}
                </button>
              </div>
            </div>
          </motion.header>

          {/* ── Onglets ────────────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="mt-14"
          >
            <Tabs defaultValue="structure" className="w-full">
              <TabsList
                className="flex h-auto w-full flex-wrap justify-start gap-7 rounded-none bg-transparent p-0"
                style={{ borderBottom: `1px solid ${C.line}` }}
              >
                <TabsTrigger value="structure" className={tabCls}>Structure &amp; Contenu</TabsTrigger>
                <TabsTrigger value="students" className={tabCls}>Étudiants inscrits</TabsTrigger>
                <TabsTrigger value="stats" className={tabCls}>Statistiques</TabsTrigger>
              </TabsList>

              {/* Structure & contenu */}
              <TabsContent value="structure" className="mt-8">
                {modules.length === 0 ? (
                  <Empty
                    icon={Layers}
                    title="Ce cours n'a pas encore de modules"
                    hint="Ajoutez du contenu depuis le Studio pour construire le programme."
                  />
                ) : (
                  <div style={{ borderTop: `1px solid ${C.line}` }}>
                    <Accordion type="multiple" defaultValue={[modules[0]?.id]} className="w-full">
                      {modules.map((module, idx) => {
                        const weeks = module.weeks || [];
                        const dayCount = weeks.reduce((a, w) => a + (w.days?.length || 0), 0);
                        return (
                          <AccordionItem
                            key={module.id}
                            value={module.id}
                            className="border-0"
                            style={{ borderBottom: `1px solid ${C.line}` }}
                          >
                            <AccordionTrigger
                              className="py-4 hover:no-underline [&[data-state=open]>svg]:text-[color:var(--school-accent)]"
                              style={{ color: C.ink }}
                            >
                              <div className="flex min-w-0 items-center gap-4 text-left">
                                <span
                                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                                  style={{ background: soft(14), color: A }}
                                >
                                  {idx + 1}
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-[15px] font-semibold" style={{ color: C.ink }}>
                                    {module.title}
                                  </span>
                                  <span className="mt-0.5 block text-xs" style={{ color: C.ink3 }}>
                                    {weeks.length} semaine{s(weeks.length)} · {dayCount} leçon{s(dayCount)}
                                  </span>
                                </span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-5">
                              {weeks.length === 0 ? (
                                <p className="pl-[3.25rem] text-sm" style={{ color: C.ink3 }}>
                                  Aucune semaine dans ce module.
                                </p>
                              ) : (
                                <div className="space-y-6 pl-[3.25rem]">
                                  {weeks.map((week) => (
                                    <div key={week.id}>
                                      <div className="flex items-center gap-2">
                                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: A }} />
                                        <h5 className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: C.ink2 }}>
                                          {week.title}
                                        </h5>
                                      </div>
                                      <ul className="mt-2 space-y-0.5">
                                        {(week.days || []).length === 0 && (
                                          <li className="py-1.5 text-sm" style={{ color: C.ink3 }}>Aucune leçon.</li>
                                        )}
                                        {(week.days || []).map((day) => {
                                          const vids = day.videos || [];
                                          return (
                                            <li
                                              key={day.id}
                                              className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors"
                                              style={{ marginLeft: '-0.75rem' }}
                                              onMouseEnter={(e) => { e.currentTarget.style.background = C.raise; }}
                                              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                            >
                                              <PlayCircle className="h-4 w-4 shrink-0" style={{ color: soft(90) }} />
                                              <span className="min-w-0 flex-1 truncate text-sm font-medium" style={{ color: C.ink }}>
                                                {day.title}
                                              </span>
                                              <div className="flex shrink-0 items-center gap-3 text-[11px] font-semibold" style={{ color: C.ink3 }}>
                                                {vids.length > 0 && (
                                                  <span className="inline-flex items-center gap-1"><Video className="h-3.5 w-3.5" style={{ color: A }} />{vids.length}</span>
                                                )}
                                                {day.powerpoint && (
                                                  <span className="inline-flex items-center gap-1"><Presentation className="h-3.5 w-3.5" />Support</span>
                                                )}
                                                {day.quiz && (
                                                  <span className="inline-flex items-center gap-1" style={{ color: C.success }}><CheckCircle2 className="h-3.5 w-3.5" />Quiz</span>
                                                )}
                                              </div>
                                            </li>
                                          );
                                        })}
                                      </ul>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  </div>
                )}
              </TabsContent>

              {/* Étudiants inscrits */}
              <TabsContent value="students" className="mt-8">
                {students.length === 0 ? (
                  <Empty
                    icon={Users}
                    title="Aucun étudiant inscrit"
                    hint="Les inscriptions apparaîtront ici dès qu'un étudiant rejoint cette formation."
                  />
                ) : (
                  <div className="overflow-hidden rounded-2xl" style={{ border: `1px solid ${C.line}` }}>
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${C.line}` }}>
                          <th className="p-4 text-xs font-semibold uppercase tracking-wide" style={{ color: C.ink3 }}>Étudiant</th>
                          <th className="hidden p-4 text-xs font-semibold uppercase tracking-wide sm:table-cell" style={{ color: C.ink3 }}>Inscription</th>
                          <th className="p-4 text-xs font-semibold uppercase tracking-wide" style={{ color: C.ink3 }}>Progression</th>
                          <th className="p-4 text-xs font-semibold uppercase tracking-wide" style={{ color: C.ink3 }}>Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((student, i) => (
                          <tr
                            key={student.id}
                            style={{ borderTop: i === 0 ? 'none' : `1px solid ${C.lineSoft}` }}
                            className="transition-colors"
                            onMouseEnter={(e) => { e.currentTarget.style.background = C.raise; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                          >
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                  <AvatarImage src={student.avatar} />
                                  <AvatarFallback style={{ background: soft(16), color: A }}>{student.name?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="truncate font-semibold" style={{ color: C.ink }}>{student.name}</p>
                                  <p className="truncate text-xs" style={{ color: C.ink3 }}>{student.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="hidden p-4 sm:table-cell" style={{ color: C.ink2 }}>
                              {student.enrollmentDate ? format(new Date(student.enrollmentDate), 'dd MMM yyyy', { locale: fr }) : '—'}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2.5">
                                <div className="h-1.5 w-24 overflow-hidden rounded-full" style={{ background: C.line }}>
                                  <div className="h-full rounded-full" style={{ width: `${student.progress || 0}%`, background: A }} />
                                </div>
                                <span className="w-9 text-xs font-semibold" style={{ color: C.ink2 }}>{student.progress || 0}%</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <span
                                className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                                style={
                                  student.status === 'completed'
                                    ? { background: 'rgba(108,192,139,0.16)', color: C.success }
                                    : student.status === 'suspended'
                                      ? { background: 'rgba(240,120,120,0.16)', color: '#f0a58a' }
                                      : { background: soft(14), color: A }
                                }
                              >
                                {student.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              {/* Statistiques */}
              <TabsContent value="stats" className="mt-8">
                <FormationStatistics formation={formation} />
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </div>
    </MotionConfig>
  );
};

export default FormationDetailsPageView;
