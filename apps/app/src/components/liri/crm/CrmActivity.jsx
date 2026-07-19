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

/* ── Timeline d'activités CRM (Vague 4) — flux récent, charte chaude LIRI ── */

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

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 shrink-0 rounded-full lp-panel animate-pulse" />
      <div className="h-9 flex-1 rounded-xl lp-panel animate-pulse" />
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
    <div className="lp-rise mx-auto w-full max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-semibold lp-ink">Activité</h2>
          <p className="text-[13px] lp-muted">Le fil des derniers événements de votre CRM.</p>
        </div>
        <button
          type="button"
          aria-label="Rafraîchir"
          onClick={load}
          className="grid h-9 w-9 cursor-pointer place-items-center rounded-xl lp-muted lp-railbtn lp-tr"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {loading && (
        <div className="space-y-3 rounded-2xl border lp-line lp-panel70 p-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      )}

      {!loading && errored && (
        <div className="rounded-2xl border lp-line lp-panel70 p-5 text-center">
          <p className="text-[13.5px] lp-muted">Impossible de charger l'activité pour le moment.</p>
          <button
            type="button"
            onClick={load}
            className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-[13.5px] font-medium text-white lp-tr lp-ember"
          >
            <RefreshCw size={15} /> Réessayer
          </button>
        </div>
      )}

      {!loading && !errored && items.length === 0 && (
        <div className="rounded-2xl border border-dashed lp-line lp-panel70 px-6 py-14 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl lp-coral-tint">
            <Inbox size={22} className="lp-coral" />
          </div>
          <h3 className="mt-4 text-[15px] font-semibold lp-ink">Aucune activité pour l'instant</h3>
          <p className="mx-auto mt-1 max-w-sm text-[13px] lp-muted">
            Créez un deal, ajoutez une note ou convertissez un lead : tout apparaîtra ici.
          </p>
        </div>
      )}

      {!loading && !errored && items.length > 0 && (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.key}>
              <h3 className="mb-2 px-1 text-[12px] font-medium uppercase tracking-wide lp-faint">
                {g.label}
              </h3>
              <div className="overflow-hidden rounded-2xl border lp-line lp-panel70">
                {g.items.map((a, idx) => {
                  const { icon: Icon, label } = metaFor(a.type);
                  return (
                    <div
                      key={a.id}
                      className={`flex items-start gap-3 px-4 py-3 ${
                        idx > 0 ? 'border-t lp-line' : ''
                      }`}
                    >
                      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full lp-coral-tint">
                        <Icon size={15} className="lp-coral" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] lp-ink">{a.title || label}</p>
                        <p className="mt-0.5 text-[12px] lp-faint">
                          {label} · {TIME_FMT.format(a._date)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
