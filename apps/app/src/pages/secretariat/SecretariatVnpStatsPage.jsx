// SecretariatVnpStatsPage — lecteur des stats de conversation VNP (§6) pour le back-office.
// Donne au fondateur la VISIBILITÉ qui manquait : entonnoir d'engagement, sujets les plus demandés,
// conversions, et signal des questions sans réponse (trous de connaissance). Lecture via la RPC
// SECURITY DEFINER `vnp_stats()` (gatée staff — les 4 vues sont service_role only). Aucune écriture.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, BarChart3, TrendingUp, MousePointerClick, HelpCircle } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';

const FUNNEL_LABELS = {
  node_opened: 'Sujets ouverts', vnp_chat: 'Questions posées', action_triggered: 'Actions déclenchées',
  contact_submitted: 'Messages envoyés', booking_submitted: 'RDV demandés', tenant_created: 'Organisations créées',
  unanswered_question: 'Questions sans réponse', phase_transition: 'Transitions', shortcut_click: 'Raccourcis',
  edge_chat: 'Chat (moteur)', edge_agent_brain: 'Cerveau (moteur)',
};
const ACTION_LABELS = {
  contacter: 'Nous contacter', reserver: 'Réserver un RDV', comparer: 'Comparer', acheter: 'Acheter',
  decouvrir: 'Découvrir', rejoindre: 'Rejoindre', participer: 'Participer', telecharger: 'Télécharger', comprendre: 'Comprendre',
};
const NODE_LABELS = {
  produits: 'Forfaits', identity: 'Identité', mission: 'Mission', vision: 'Vision', valeurs: 'Valeurs',
  histoire: 'Histoire', equipe: 'Équipe', fondateur: 'Fondateur', services: 'Services', solutions: 'Parcours',
  realisations: 'Réalisations', documentation: 'Documentation', ressources: 'Ressources', faq: 'FAQ',
  contact: 'Contact', support: 'Support',
};
const labelOf = (map, key) => map[key] || String(key || '—');

function Bar({ label, value, max, sub }) {
  const pct = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-40 shrink-0 text-sm text-[var(--lt-text)] truncate" title={label}>
        {label}{sub ? <span className="text-[var(--lt-muted)]"> · {sub}</span> : null}
      </div>
      <div className="flex-1 h-2.5 rounded-full bg-[var(--lt-border)] overflow-hidden">
        <div className="h-full rounded-full bg-[var(--lt-gold-ink)] transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="w-10 shrink-0 text-right text-sm font-semibold text-[var(--lt-text)] tabular-nums">{value}</div>
    </div>
  );
}

function Card({ icon: Icon, title, hint, children }) {
  return (
    <div className="rounded-2xl border border-[var(--lt-border)] bg-[var(--lt-card-bg)] p-4 sm:p-5 space-y-3">
      <div>
        <h3 className="text-sm font-bold text-[var(--lt-text)] flex items-center gap-2">
          <Icon className="w-4 h-4 text-[var(--lt-gold-ink)]" />{title}
        </h3>
        {hint ? <p className="text-xs text-[var(--lt-muted)] mt-0.5">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

export default function SecretariatVnpStatsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const { data, error: rpcErr } = await supabase.rpc('vnp_stats');
    if (rpcErr) { setError(rpcErr.message || 'Chargement impossible.'); setStats(null); }
    else setStats(data || {});
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const funnel = useMemo(() => (stats?.funnel || []).filter((r) => r.type !== 'unanswered_question'), [stats]);
  const topNodes = useMemo(() => stats?.top_nodes || [], [stats]);
  const actions = useMemo(() => stats?.actions || [], [stats]);
  const unanswered = useMemo(
    () => (stats?.unanswered || []).reduce((n, r) => n + Number(r.nb || 0), 0),
    [stats],
  );

  const funnelMax = Math.max(1, ...funnel.map((r) => Number(r.nb || 0)));
  const nodesMax = Math.max(1, ...topNodes.map((r) => Number(r.ouvertures || 0)));
  const actionsMax = Math.max(1, ...actions.map((r) => Number(r.nb || 0)));
  const totalEvents = funnel.reduce((n, r) => n + Number(r.nb || 0), 0);
  const totalActions = actions.reduce((n, r) => n + Number(r.nb || 0), 0);
  const empty = !loading && !error && totalEvents === 0 && topNodes.length === 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--lt-text)] flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[var(--lt-gold-ink)]" />
            Trafic &amp; conversations (VNP)
          </h2>
          <p className="text-xs text-[var(--lt-muted)] mt-0.5">
            Ce que les visiteurs explorent et convertissent dans l'assistant du site.
          </p>
        </div>
        <Button onClick={load} variant="outline" size="sm" disabled={loading}
          className="border-[var(--lt-border)] bg-[var(--lt-card-bg)] text-[var(--lt-text)] hover:opacity-80">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</div>
      ) : null}

      {loading ? (
        <div className="text-sm text-[var(--lt-muted)] py-8 text-center">Chargement des statistiques…</div>
      ) : empty ? (
        <div className="rounded-2xl border border-[var(--lt-border)] bg-[var(--lt-card-bg)] p-8 text-center text-sm text-[var(--lt-muted)]">
          Aucune donnée pour l'instant — les statistiques apparaîtront dès que des visiteurs échangeront avec l'assistant.
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Interactions', value: totalEvents },
              { label: 'Conversions (actions)', value: totalActions },
              { label: 'Questions sans réponse', value: unanswered, warn: unanswered > 0 },
            ].map((k) => (
              <div key={k.label} className="rounded-2xl border border-[var(--lt-border)] bg-[var(--lt-card-bg)] p-4">
                <div className={`text-2xl font-bold tabular-nums ${k.warn ? 'text-amber-500' : 'text-[var(--lt-text)]'}`}>{k.value}</div>
                <div className="text-xs text-[var(--lt-muted)] mt-0.5">{k.label}</div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card icon={TrendingUp} title="Entonnoir d'engagement" hint="Volume par type d'interaction.">
              {funnel.length ? (
                <div className="space-y-2.5">
                  {funnel.map((r) => <Bar key={r.type} label={labelOf(FUNNEL_LABELS, r.type)} value={Number(r.nb || 0)} max={funnelMax} />)}
                </div>
              ) : <p className="text-sm text-[var(--lt-muted)]">Pas encore d'interactions.</p>}
            </Card>

            <Card icon={MousePointerClick} title="Conversions" hint="Actions déclenchées (contact, RDV, achat…).">
              {actions.length ? (
                <div className="space-y-2.5">
                  {actions.map((r) => <Bar key={r.action} label={labelOf(ACTION_LABELS, r.action)} value={Number(r.nb || 0)} max={actionsMax} />)}
                </div>
              ) : <p className="text-sm text-[var(--lt-muted)]">Aucune action déclenchée pour l'instant.</p>}
            </Card>
          </div>

          <Card icon={BarChart3} title="Sujets les plus demandés" hint="Les nœuds du site les plus ouverts par les visiteurs.">
            {topNodes.length ? (
              <div className="space-y-2.5">
                {topNodes.map((r) => (
                  <Bar key={r.node_id} label={labelOf(NODE_LABELS, r.node_id)} value={Number(r.ouvertures || 0)} max={nodesMax}
                    sub={Number(r.via_tour || 0) > 0 ? `${r.via_tour} via visite` : null} />
                ))}
              </div>
            ) : <p className="text-sm text-[var(--lt-muted)]">Aucun sujet ouvert pour l'instant.</p>}
          </Card>

          {unanswered > 0 ? (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 flex items-start gap-3">
              <HelpCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm text-[var(--lt-text)]">
                <b>{unanswered} question{unanswered > 1 ? 's' : ''} sans réponse</b> — l'assistant n'a pas su répondre.
                C'est le signal le plus utile : enrichissez la connaissance du site pour les couvrir.
                <span className="block text-xs text-[var(--lt-muted)] mt-1">
                  (Le texte des questions n'est pas conservé — seul leur nombre l'est, par respect de la vie privée.)
                </span>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
