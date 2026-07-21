import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Award,
  Ban,
  ArrowRightLeft,
  Plus,
  Pencil,
  Trash2,
  StickyNote,
  UserPlus,
  Building2,
  RefreshCw,
  Inbox,
} from 'lucide-react';
import { crmApi } from '@/lib/api-v2';
import { useToast } from '@/components/ui/use-toast';

/* ── Timeline d'activités CRM (Vague 4) — flux récent, charte chaude LIRI ──
   Design : en-tête à pastille, groupes par jour en petites-caps, rail vertical
   avec pastilles coral-tint et icône par type. */

const TYPE_META = {
  deal_created: { icon: Plus, label: 'Deal créé' },
  deal_stage_moved: { icon: ArrowRightLeft, label: 'Deal déplacé' },
  deal_won: { icon: Award, label: 'Deal gagné' },
  deal_lost: { icon: Ban, label: 'Deal perdu' },
  deal_deleted: { icon: Trash2, label: 'Deal supprimé' },
  deal_updated: { icon: Pencil, label: 'Deal modifié' },
  note_added: { icon: StickyNote, label: 'Note' },
  contact_created: { icon: UserPlus, label: 'Contact créé' },
  company_created: { icon: Building2, label: 'Société créée' },
  lead_converted: { icon: UserPlus, label: 'Lead converti' },
};

function metaFor(type) {
  return TYPE_META[type] || { icon: Activity, label: String(type || 'Activité').replace(/_/g, ' ') };
}

const DAY_FMT = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const TIME_FMT = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

function dayKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(d) {
  const today = new Date();
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  if (dayKey(d) === dayKey(today)) return "Aujourd'hui";
  if (dayKey(d) === dayKey(y)) return 'Hier';
  const s = DAY_FMT.format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function groupByDay(items) {
  const groups = [];
  let current = null;
  for (const a of items) {
    const d = new Date(a.created_at);
    const k = dayKey(d);
    if (!current || current.key !== k) {
      current = { key: k, label: dayLabel(d), items: [] };
      groups.push(current);
    }
    current.items.push({ ...a, _date: d });
  }
  return groups;
}

/* ── Libellé de groupe (jour) — petites-caps + compteur ── */
function DayHead({ label, count }) {
  return (
    <div className="mb-3 flex items-center gap-2 px-1">
      <span className="text-[11px] font-semibold uppercase tracking-[.09em] lp-muted">{label}</span>
      {count > 0 && <span className="text-[11px] font-medium lp-faint">· {count}</span>}
    </div>
  );
}

/* ── Ligne fantôme du rail (chargement) ── */
function SkeletonRow() {
  return (
    <div className="relative flex items-start gap-3.5 py-1.5">
      <div className="relative z-10 h-8 w-8 shrink-0 rounded-full lp-panel animate-pulse" />
      <div className="min-w-0 flex-1 space-y-2 pt-1">
        <div className="h-3 w-2/3 rounded-full lp-panel animate-pulse" />
        <div className="h-2.5 w-1/4 rounded-full lp-panel animate-pulse" />
      </div>
    </div>
  );
}

export default function CrmActivity() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [errored, setErrored] = useState(false);
  const reqRef = useRef(0);

  const load = useCallback(async () => {
    const rid = ++reqRef.current;
    setLoading(true);
    setErrored(false);
    try {
      const rows = await crmApi.listActivities({ limit: '100' });
      if (rid !== reqRef.current) return;
      setItems(Array.isArray(rows) ? rows : []);
    } catch (e) {
      if (rid !== reqRef.current) return;
      setErrored(true);
      toast({ title: 'CRM', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      if (rid === reqRef.current) setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => groupByDay(items), [items]);

  return (
    <div className="lp-rise mx-auto w-full max-w-3xl space-y-6">
      {/* ── En-tête d'écran ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <div
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white"
            style={{ background: 'linear-gradient(140deg,var(--crm-accent, #d97757),var(--crm-accent-strong, #c2683f))' }}
          >
            <Activity size={19} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-[18px] font-semibold leading-tight lp-ink">Activité</h2>
            <p className="truncate text-[13px] lp-muted">Le fil des derniers événements de votre CRM.</p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Rafraîchir"
          onClick={load}
          className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl lp-muted lp-railbtn lp-tr"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── Chargement — aperçu du rail ── */}
      {loading && (
        <div className="space-y-7">
          {[0, 1].map((g) => (
            <div key={g}>
              <div className="mb-3 h-3 w-28 rounded-full lp-panel animate-pulse" />
              <div className="relative pl-1">
                <span
                  className="absolute left-[19px] top-3 bottom-3 w-px"
                  style={{ background: 'var(--line)' }}
                />
                <div className="space-y-1">
                  {[0, 1, 2].map((i) => (
                    <SkeletonRow key={i} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Erreur ── */}
      {!loading && errored && (
        <div className="rounded-2xl border lp-line lp-panel70 px-6 py-12 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl lp-coral-tint">
            <RefreshCw size={20} className="lp-coral" />
          </div>
          <h3 className="mt-4 text-[15px] font-semibold lp-ink">Chargement impossible</h3>
          <p className="mx-auto mt-1 max-w-sm text-[13px] lp-muted">
            Impossible de charger l'activité pour le moment.
          </p>
          <button
            type="button"
            onClick={load}
            className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-[13.5px] font-medium text-white lp-tr lp-ember"
          >
            <RefreshCw size={15} /> Réessayer
          </button>
        </div>
      )}

      {/* ── Vide ── */}
      {!loading && !errored && items.length === 0 && (
        <div className="rounded-2xl border border-dashed lp-line lp-panel70 px-6 py-16 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl lp-coral-tint">
            <Inbox size={22} className="lp-coral" />
          </div>
          <h3 className="mt-4 text-[15px] font-semibold lp-ink">Aucune activité pour l'instant</h3>
          <p className="mx-auto mt-1 max-w-sm text-[13px] lp-muted">
            Créez un deal, ajoutez une note ou convertissez un lead : tout apparaîtra ici.
          </p>
        </div>
      )}

      {/* ── Flux — un rail vertical par jour ── */}
      {!loading && !errored && items.length > 0 && (
        <div className="space-y-7">
          {groups.map((g) => (
            <div key={g.key}>
              <DayHead label={g.label} count={g.items.length} />
              <div className="relative pl-1">
                {/* fil du rail */}
                <span
                  className="absolute left-[19px] top-4 bottom-4 w-px"
                  style={{ background: 'var(--line)' }}
                />
                <div className="space-y-0.5">
                  {g.items.map((a) => {
                    const { icon: Icon, label } = metaFor(a.type);
                    return (
                      <div
                        key={a.id}
                        className="group relative flex items-start gap-3.5 rounded-xl py-2.5 pr-2 lp-tr hover:bg-[rgba(245,244,238,.04)]"
                      >
                        <span className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full lp-coral-tint">
                          <Icon size={15} className="lp-coral" />
                        </span>
                        <div className="min-w-0 flex-1 pt-1">
                          <p className="truncate text-[13.5px] leading-snug lp-ink">
                            {a.title || label}
                          </p>
                          <p className="mt-0.5 text-[12px] lp-faint">
                            {label} · <span className="tabular-nums">{TIME_FMT.format(a._date)}</span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
