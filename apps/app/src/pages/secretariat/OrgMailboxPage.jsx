import React from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Mail,
  Send,
  Loader2,
  RefreshCw,
  ArrowLeft,
  Inbox,
  Tag,
  Sparkles,
  Settings2,
  Star,
  CheckCircle2,
  Flame,
  Calendar,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { useOrgMailbox, PIPELINE, getSuggestedOffer } from '@/hooks/useOrgMailbox';
import { useVitrineContactEmail } from '@/contexts/VitrineContactEmailContext';
import DOMPurify from 'dompurify';

const FILTER_PILLS = [
  { value: 'all', label: 'Tous' },
  { value: 'new', label: 'Nouveaux' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'to_treat', label: 'À traiter' },
  { value: 'converted', label: 'Convertis' },
];

/* Chips pipeline par VARIABLES --lt-* : le composant sert deux shells (secrétariat
   clair/sombre + LIRI chaud) — toute couleur en dur casse l'un des deux. */
function pipelineChipClass(status) {
  switch (status) {
    case 'to_treat':
      return 'border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] text-[var(--lt-gold-ink)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]';
    default:
      return 'border-[var(--lt-border)] text-[var(--lt-sub)] bg-transparent';
  }
}

/**
 * Courrier infos@ — UI type Mail CRM (dossier messagerie) + thème premium secrétariat (sombre / or).
 * @param {{ embedded?: boolean }} props — si true (messagerie unifiée), en-tête compact sans doublon de page.
 */
/**
 * Iframe de mail à HAUTEUR AUTOMATIQUE — le courrier prend tout son gabarit,
 * c'est le FIL qui défile (modèle Gmail), plus jamais une boîte de 300 px avec
 * le vide en dessous.
 *
 * SÉCURITÉ, à ne pas défaire : le HTML entrant reste assaini par DOMPurify ET
 * le sandbox n'accorde PAS `allow-scripts` — aucun JS du mail ne s'exécute.
 * `allow-same-origin` est ajouté UNIQUEMENT pour pouvoir MESURER la hauteur du
 * document (sans lui, l'iframe est d'origine opaque et sa hauteur reste figée).
 * Sans script exécutable à l'intérieur, cette permission n'ouvre rien.
 */
function CadreMailAutoHauteur({ titre, srcDoc }) {
  const ref = React.useRef(null);
  const [hauteur, setHauteur] = React.useState(300);
  const mesurer = React.useCallback(() => {
    try {
      const doc = ref.current?.contentDocument;
      const h = Math.max(
        doc?.body?.scrollHeight || 0,
        doc?.documentElement?.scrollHeight || 0,
      );
      if (h > 0) setHauteur(h + 8);
    } catch { /* iframe pas encore prête — la mesure suivante rattrapera */ }
  }, []);
  React.useEffect(() => {
    const doc = ref.current?.contentDocument;
    if (!doc?.documentElement || typeof ResizeObserver === 'undefined') return undefined;
    /* Les images d'une newsletter chargent APRÈS l'onLoad : sans observation,
       la hauteur mesurée trop tôt recouperait le bas du courrier. */
    const ro = new ResizeObserver(mesurer);
    ro.observe(doc.documentElement);
    return () => ro.disconnect();
  }, [mesurer, srcDoc]);
  return (
    <iframe
      ref={ref}
      title={titre}
      sandbox="allow-same-origin"
      referrerPolicy="no-referrer"
      onLoad={mesurer}
      className="w-full bg-white rounded-xl shadow-[0_2px_24px_-10px_rgba(0,0,0,0.55)]"
      style={{ height: hauteur, border: 0 }}
      scrolling="no"
      srcDoc={srcDoc}
    />
  );
}

const OrgMailboxPage = ({ embedded = false }) => {
  const VITRINE_EMAIL = useVitrineContactEmail();
  const m = useOrgMailbox();

  const syncStatusLabel = m.mailbox?.sync_status || '—';
  const lastSync =
    m.mailbox?.last_synced_at && format(new Date(m.mailbox.last_synced_at), 'PPp', { locale: fr });

  return (
    <div className={cn('w-full max-w-[1600px] mx-auto', !embedded && 'flex-1 min-h-0 flex flex-col')}>
      {/* En-tête sur UNE ligne : titre + adresse + état de synchro (plus de bandeau vide) */}
      {!embedded ? (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mb-3 min-w-0 shrink-0">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--school-accent)_16%,transparent)] text-[var(--lt-gold-ink)] shrink-0">
            <Mail className="w-4 h-4" />
          </span>
          <h2 className="text-base md:text-lg font-bold text-[var(--lt-text)] leading-tight">Courrier</h2>
          {VITRINE_EMAIL ? (
            <p className="text-xs text-[var(--lt-muted)] font-mono truncate min-w-0">{VITRINE_EMAIL}</p>
          ) : null}
          <p className="ml-auto text-[11px] text-[var(--lt-muted)] font-mono shrink-0">
            {m.mailbox?.last_synced_at ? `Dernier sync : ${lastSync}` : 'Pas encore synchronisé'}
          </p>
        </div>
      ) : null}

      <div
        className={cn(
          'flex flex-col lg:flex-row rounded-[14px] border border-[var(--lt-border)] bg-[var(--lt-card-bg)] overflow-hidden shadow-[var(--lt-card-shadow)]',
          embedded
            ? 'min-h-[min(640px,calc(100vh-14rem))] h-[min(720px,calc(100vh-12rem))]'
            : // min-h-[420px] (et pas min-h-0) : plancher si le parent ne borne pas la
              // hauteur, tout en autorisant flex à rétrécir sous la taille du contenu.
              'flex-1 min-h-[420px]'
        )}
      >
        {/* Rail icônes (comme le mock HTML) */}
        <nav className="flex lg:flex-col flex-row lg:w-[52px] w-full lg:h-auto h-12 shrink-0 bg-[var(--lt-inner-bg)] border-b lg:border-b-0 lg:border-r border-[var(--lt-border)] items-center justify-center lg:justify-start gap-0.5 lg:py-4 lg:px-0 px-2 py-1">
          <RailBtn
            active={m.mailView === 'inbox'}
            title="Boîte de réception"
            onClick={() => {
              m.setMailView('inbox');
            }}
            badge={m.totalUnread > 0 ? m.totalUnread : null}
          >
            <Inbox className="w-[18px] h-[18px]" />
          </RailBtn>
          <RailBtn
            active={m.mailView === 'compose'}
            title="Nouveau message"
            onClick={() => m.openNewCompose()}
          >
            <Send className="w-[18px] h-[18px]" />
          </RailBtn>
          <RailBtn
            active={m.mailView === 'admin'}
            title="Admin & sync"
            onClick={() => {
              m.setMailView('admin');
              m.setSelectedId(null);
            }}
          >
            <Settings2 className="w-[18px] h-[18px]" />
          </RailBtn>
          <RailBtn
            active={m.mailView === 'leads'}
            title="Leads email"
            onClick={() => {
              m.setMailView('leads');
              m.setSelectedId(null);
            }}
          >
            <Star className="w-[18px] h-[18px]" />
          </RailBtn>
        </nav>

        {/* Vue compose plein panneau */}
        {m.mailView === 'compose' ? (
          <ComposeFullView m={m} />
        ) : m.mailView === 'admin' ? (
          <AdminFullView m={m} syncStatusLabel={syncStatusLabel} lastSync={lastSync} />
        ) : m.mailView === 'leads' ? (
          <LeadsFullView m={m} />
        ) : (
          <>
            {/* Sidebar liste */}
            <aside className="w-full lg:w-[min(280px,32vw)] shrink-0 flex flex-col border-b lg:border-b-0 lg:border-r border-[var(--lt-border)] bg-[var(--lt-inner-bg)] min-h-0">
              <div className="px-4 pt-3.5 pb-2 border-b border-[var(--lt-border)] flex items-baseline gap-2 min-w-0">
                <p className="text-sm font-bold text-[var(--lt-text)]">Conversations</p>
                <span className="text-[11px] text-[var(--lt-muted)] font-mono">{m.filteredThreads.length}</span>
                {/* En mode intégré, la page ne montre pas l'en-tête Courrier : l'adresse vit ici. */}
                {embedded && VITRINE_EMAIL ? (
                  <span className="ml-auto text-[10px] text-[var(--lt-muted)] font-mono truncate min-w-0">{VITRINE_EMAIL}</span>
                ) : null}
              </div>
              <div className="px-3 py-2 border-b border-[var(--lt-border)] relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--lt-muted)]" />
                <Input
                  placeholder="Rechercher…"
                  value={m.search}
                  onChange={(e) => m.setSearch(e.target.value)}
                  className="pl-9 h-9 bg-[var(--lt-card-bg)] border-[var(--lt-border)] text-[var(--lt-text)] text-sm rounded-lg"
                />
              </div>
              <div className="px-2 py-2 border-b border-[var(--lt-border)] flex flex-wrap gap-1.5">
                {FILTER_PILLS.map((f) => {
                  const count =
                    f.value === 'all'
                      ? m.threads.length
                      : m.threads.filter((t) => t.pipeline_status === f.value).length;
                  return (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => m.setFilterPipeline(f.value)}
                      className={cn(
                        'px-2 py-1 rounded-full text-[11px] font-medium border transition-colors',
                        m.filterPipeline === f.value
                          ? 'bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] text-[var(--lt-gold-ink)]'
                          : 'border-[var(--lt-border)] bg-[var(--lt-card-bg)] text-[var(--lt-sub)] hover:border-black/25 hover:text-[var(--lt-text)]'
                      )}
                    >
                      {f.label}
                      <span className="ml-1 font-mono text-[10px] opacity-70">{count}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                {m.loading ? (
                  <div className="p-3 space-y-2" aria-busy="true">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="h-14 rounded-lg animate-pulse bg-[color-mix(in_srgb,var(--lt-text)_7%,transparent)]"
                      />
                    ))}
                  </div>
                ) : m.filteredThreads.length === 0 ? (
                  <div className="p-8 text-center text-sm text-[var(--lt-muted)]">
                    {m.threads.length === 0
                      ? 'Boîte vide — « Synchroniser » ci-dessous rapatrie les mails IMAP.'
                      : 'Aucun fil ne correspond à ce filtre ou à cette recherche.'}
                  </div>
                ) : (
                  m.filteredThreads.map((t) => {
                    const last = (m.emailsByThread[t.id] || []).slice(-1)[0];
                    const unread = m.unreadInThread(t.id);
                    const rel =
                      last?.received_at &&
                      formatDistanceToNow(new Date(last.received_at), { addSuffix: true, locale: fr });
                    // Le nom de l'expéditeur est plus parlant que noreply@… (toujours identique).
                    const senderLabel = last?.from_name || t.primary_contact_email || '—';
                    const chipLabel =
                      t.pipeline_status && t.pipeline_status !== 'new'
                        ? PIPELINE.find((p) => p.value === t.pipeline_status)?.label || t.pipeline_status
                        : null;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => void m.openThread(t)}
                        className={cn(
                          'w-full text-left px-3.5 py-2.5 border-b border-[var(--lt-border)] hover:bg-black/[0.03] transition-colors',
                          m.selectedId === t.id && 'bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {unread > 0 ? (
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-[var(--school-accent)] shrink-0"
                              aria-label="Non lu"
                            />
                          ) : null}
                          <span
                            className={cn(
                              'text-[13px] truncate flex-1 min-w-0',
                              unread ? 'font-semibold text-[var(--lt-text)]' : 'text-[var(--lt-sub)]'
                            )}
                          >
                            {t.subject || '(Sans objet)'}
                          </span>
                          <span className="text-[10px] text-[var(--lt-muted)] shrink-0">{rel || ''}</span>
                        </div>
                        {last?.snippet ? (
                          <p className="text-[11px] text-[var(--lt-muted)] mt-0.5 line-clamp-1">{last.snippet}</p>
                        ) : null}
                        <div className="flex items-center gap-1.5 mt-1 min-w-0">
                          <span className="text-[11px] text-[var(--lt-muted)] truncate min-w-0">{senderLabel}</span>
                          {chipLabel ? (
                            <span
                              className={cn(
                                'ml-auto shrink-0 text-[10px] px-1.5 py-0 rounded-full border',
                                pipelineChipClass(t.pipeline_status)
                              )}
                            >
                              {chipLabel}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
              {/* Pied de colonne : barre d'actions PROPRE (grid 2 col, libellés qui tiennent
                  dans min(280px,32vw)) — plus de bouton tronqué ni flottant sur la liste. */}
              <div className="p-2.5 border-t border-[var(--lt-border)] space-y-2 shrink-0 bg-[var(--lt-inner-bg)]">
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-w-0 px-2 text-xs border-[var(--lt-border)] bg-[var(--lt-card-bg)] text-[var(--lt-text)] hover:opacity-80 justify-center gap-1.5"
                    onClick={() => void m.runImapSync()}
                    disabled={m.loading || m.syncing || !m.session}
                  >
                    {/* Pas d'icône statique : à 127 px de colonne elle tronquait le libellé. */}
                    {m.syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : null}
                    <span className="truncate">Synchroniser</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-w-0 px-2 text-xs justify-center gap-1.5 text-[var(--lt-gold-ink)]"
                    style={{
                      borderColor: 'color-mix(in srgb, var(--school-accent) 40%, transparent)',
                      background: 'color-mix(in srgb, var(--school-accent) 12%, transparent)',
                    }}
                    onClick={() => void m.runSummary()}
                    disabled={m.summarizing}
                    title="Résumé IA de la boîte (Mistral)"
                  >
                    {m.summarizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span className="truncate">Résumer IA</span>
                  </Button>
                </div>
                {m.summary ? (
                  <div className="rounded-lg border border-[var(--lt-border)] bg-[var(--lt-inner-bg)] p-2.5 max-h-[240px] overflow-y-auto">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[var(--lt-gold-ink)]">
                        <Sparkles className="w-3 h-3" /> Résumé IA
                      </span>
                      <button
                        type="button"
                        onClick={() => m.setSummary('')}
                        className="text-xs text-[var(--lt-muted)] hover:text-[var(--lt-text)]"
                        aria-label="Fermer le résumé"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="whitespace-pre-line text-[12px] leading-relaxed text-[var(--lt-sub)]">{m.summary}</p>
                  </div>
                ) : null}
                {/* Hors mode intégré, l'état de synchro vit dans l'en-tête de page. */}
                {embedded ? (
                  <p className="text-[10px] text-center text-[var(--lt-muted)] font-mono">
                    {m.mailbox?.last_synced_at ? `Dernier sync : ${lastSync}` : 'Pas encore synchronisé'}
                  </p>
                ) : null}
              </div>
            </aside>

            {/* Panneau principal + méta */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[var(--lt-card-bg)]">
              {!m.selected ? (
                <div className="flex-1 flex flex-col items-center justify-center text-[var(--lt-muted)] gap-3 p-8">
                  <div className="w-16 h-16 rounded-2xl border border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_8%,transparent)] flex items-center justify-center">
                    <Mail className="w-8 h-8 text-[var(--lt-gold-ink)]" />
                  </div>
                  <p className="text-[var(--lt-sub)] font-medium">Sélectionnez un thread</p>
                  <p className="text-sm text-[var(--lt-muted)] text-center max-w-sm">
                    Cliquez sur une conversation dans la liste pour lire les messages.
                  </p>
                </div>
              ) : (
                <div className="flex flex-1 flex-col xl:flex-row min-h-0">
                  {/* overflow-hidden : AUCUN pixel de mail ne doit sortir du panneau —
                      le corps scrolle dans la timeline, jamais sous la coque. */}
                  <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
                    {/* En-tête unifié du fil : sujet (1×) + expéditeur + date + actions */}
                    {(() => {
                      const lastIn = (m.threadTimeline || [])
                        .slice()
                        .reverse()
                        .find((i) => i.kind === 'in')?.data;
                      const senderName =
                        lastIn?.from_name || m.selected.primary_contact_email || 'Expéditeur';
                      const senderEmail = lastIn?.from_email || m.selected.primary_contact_email || '';
                      const dateLabel = lastIn?.received_at
                        ? format(new Date(lastIn.received_at), "d MMM yyyy 'à' HH:mm", { locale: fr })
                        : null;
                      return (
                        <div className="px-4 sm:px-5 py-3.5 border-b border-[var(--lt-border)] bg-[var(--lt-inner-bg)] shrink-0">
                          <div className="flex items-start gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-[var(--lt-sub)] hover:bg-black/[0.04] xl:hidden -ml-2 shrink-0 px-2"
                              onClick={() => m.setSelectedId(null)}
                            >
                              <ArrowLeft className="w-4 h-4" />
                            </Button>
                            <h2 className="text-[17px] md:text-lg font-bold text-[var(--lt-text)] leading-snug flex-1 min-w-0 break-words">
                              {m.selected.subject || '(Sans objet)'}
                            </h2>
                            <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-[var(--lt-border)] bg-transparent text-[var(--lt-sub)] hover:text-[var(--lt-text)] hover:bg-black/[0.04] h-8 text-xs"
                                onClick={() => void m.toggleThreadRead()}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                Lu / non lu
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] text-[var(--lt-gold-ink)] hover:bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)] h-8 text-xs"
                                onClick={() => m.openReply()}
                              >
                                <Send className="w-3.5 h-3.5 mr-1" />
                                Répondre
                              </Button>
                              <select
                                value={m.selected.pipeline_status || 'new'}
                                onChange={(e) => void m.updateThread({ pipeline_status: e.target.value })}
                                className="h-8 rounded-md border border-[var(--lt-border)] bg-[var(--lt-card-bg)] text-xs text-[var(--lt-text)] px-2"
                              >
                                {PIPELINE.map((p) => (
                                  <option key={p.value} value={p.value}>
                                    {p.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-2.5">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                              style={{
                                background:
                                  'linear-gradient(135deg, var(--school-accent), color-mix(in srgb, var(--school-accent) 50%, #000))',
                              }}
                            >
                              {m.contactInitials(m.selected)}
                            </div>
                            <span className="text-[13px] font-semibold text-[var(--lt-text)] truncate max-w-[220px]">
                              {senderName}
                            </span>
                            {senderEmail ? (
                              <span className="text-xs text-[var(--lt-muted)] truncate max-w-[240px]">
                                {senderEmail}
                              </span>
                            ) : null}
                            {dateLabel ? (
                              <span className="text-xs text-[var(--lt-muted)] shrink-0">· {dateLabel}</span>
                            ) : null}
                            <div className="flex flex-wrap gap-1.5 ml-auto">
                              {m.selected.lead_id ? (
                                <Badge className="bg-[color-mix(in_srgb,var(--school-accent)_18%,transparent)] text-[var(--lt-gold-ink)] border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] text-[10px]">
                                  Lead lié
                                </Badge>
                              ) : null}
                              {m.selected.classification_label ? (
                                <Badge variant="outline" className="text-[10px] border-black/15 text-[var(--lt-sub)]">
                                  {m.selected.classification_label}
                                  {m.selected.confidence_score != null
                                    ? ` · ${Math.round(Number(m.selected.confidence_score) * 100)}%`
                                    : ''}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Timeline messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                      {m.threadTimeline.length === 0 ? (
                        <p className="text-sm text-[var(--lt-muted)]">Aucun message.</p>
                      ) : (
                        m.threadTimeline.map((item) =>
                          item.kind === 'in' ? (
                            <article
                              key={`in-${item.data.id}`}
                              className={cn(
                                'rounded-2xl border overflow-hidden',
                                item.data.is_read
                                  ? 'border-[var(--lt-border)] bg-transparent'
                                  : 'border-[color-mix(in_srgb,var(--school-accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_6%,transparent)]'
                              )}
                            >
                              {/* Attribution par message uniquement si le fil en compte plusieurs
                                  (sinon l'en-tête du fil porte déjà expéditeur + date). */}
                              {m.threadTimeline.length > 1 ? (
                                <div className="px-4 sm:px-5 pt-3 flex items-center justify-between gap-2 text-[11px] text-[var(--lt-muted)]">
                                  <span className="font-medium text-[var(--lt-sub)] truncate">
                                    {item.data.from_name || item.data.from_email}
                                  </span>
                                  <span className="shrink-0">
                                    {item.data.received_at
                                      ? format(new Date(item.data.received_at), 'PPp', { locale: fr })
                                      : ''}
                                  </span>
                                </div>
                              ) : null}
                              {item.data.body_html ? (
                                // Email ENTRANT = non fiable. Double défense :
                                // 1) DOMPurify assainit le HTML ;
                                // 2) rendu dans une <iframe sandbox> SANS allow-scripts
                                //    (isolation d'origine, aucun JS exécuté).
                                <div className="p-3 sm:p-4">
                                  <CadreMailAutoHauteur
                                    titre={`Email de ${item.data.from_email || 'expéditeur inconnu'}`}
                                    srcDoc={`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank"><style>html,body{margin:0}body{padding:28px 24px;font:15px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#1a1a1a;word-break:break-word;max-width:680px;margin:0 auto}img{max-width:100%;height:auto}a{color:#1d4ed8}p{margin:0 0 1em}</style></head><body>${DOMPurify.sanitize(
                                      String(item.data.body_html || ''),
                                      { USE_PROFILES: { html: true } }
                                    )}</body></html>`}
                                  />
                                </div>
                              ) : (
                                <div className="px-5 sm:px-7 py-6">
                                  <div className="mx-auto max-w-[68ch] whitespace-pre-wrap font-sans text-[15px] leading-[1.7] text-[var(--lt-text)]">
                                    {item.data.body_text || '—'}
                                  </div>
                                </div>
                              )}
                            </article>
                          ) : (
                            <div
                              key={`out-${item.data.id}`}
                              className="rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_7%,transparent)] overflow-hidden"
                            >
                              <div className="px-4 py-2 flex justify-between text-[11px] text-[var(--lt-gold-ink)]">
                                <span className="font-medium">Envoyé (Resend)</span>
                                <span>
                                  {item.data.sent_at
                                    ? format(new Date(item.data.sent_at), 'PPp', { locale: fr })
                                    : item.data.created_at}
                                </span>
                              </div>
                              <div className="px-4 pb-3 text-sm text-[var(--lt-text)]">
                                <p className="font-semibold">{item.data.subject}</p>
                                <p className="text-xs text-[var(--lt-muted)] mt-1">À : {item.data.to_email}</p>
                                <pre className="mt-2 whitespace-pre-wrap font-sans text-[var(--lt-sub)]">
                                  {item.data.body_text || item.data.body_html || '—'}
                                </pre>
                              </div>
                            </div>
                          )
                        )
                      )}
                    </div>

                    {/* Réponse inline (style mock) */}
                    {m.replyOpen ? (
                      <div className="border-t border-[var(--lt-border)] p-4 bg-[var(--lt-inner-bg)] shrink-0">
                        <div className="rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] overflow-hidden bg-[var(--lt-card-bg)]">
                          <div className="px-3 py-2 border-b border-[var(--lt-border)] flex items-center gap-2 text-xs text-[var(--lt-sub)]">
                            <Send className="w-3.5 h-3.5 text-[var(--lt-gold-ink)]" />
                            Répondre à{' '}
                            <span className="text-[var(--lt-text)] font-medium">{m.form.to || '—'}</span>
                          </div>
                          <Textarea
                            value={m.form.text}
                            onChange={(e) => m.setForm((f) => ({ ...f, text: e.target.value }))}
                            className="min-h-[120px] border-0 bg-transparent rounded-none focus-visible:ring-0 text-sm text-[var(--lt-text)]"
                            placeholder="Votre message…"
                          />
                          <div className="flex flex-wrap gap-2 px-3 py-2 border-t border-[var(--lt-border)] bg-[var(--lt-inner-bg)]">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-[var(--lt-gold-ink)]"
                              style={{ borderColor: 'color-mix(in srgb, var(--school-accent) 40%, transparent)' }}
                              onClick={() => void m.draftReplyAI()}
                              disabled={m.drafting}
                              title="L'IA rédige un brouillon de réponse (Mistral)"
                            >
                              {m.drafting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                              Rédiger avec l'IA
                            </Button>
                            <Button
                              size="sm"
                              className="bg-[var(--school-accent)] text-black hover:opacity-90"
                              onClick={(e) => void m.sendMail(e)}
                              disabled={m.sending}
                            >
                              {m.sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Envoyer via Resend'}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => m.setReplyOpen(false)} className="text-[var(--lt-sub)] hover:bg-black/[0.04]">
                              Annuler
                            </Button>
                            <span className="text-[11px] text-[var(--lt-muted)] ml-auto self-center">{VITRINE_EMAIL}</span>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Méta droite — desktop */}
                  <MetaPanel m={m} />
                </div>
              )}
            </div>
          </>
        )}
      </div>

    </div>
  );
};

function RailBtn({ active, onClick, title, children, badge }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'relative w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
        active ? 'bg-[color-mix(in_srgb,var(--school-accent)_18%,transparent)] text-[var(--lt-gold-ink)]' : 'text-[var(--lt-muted)] hover:bg-black/[0.05] hover:text-[var(--lt-sub)]'
      )}
    >
      {children}
      {badge != null && badge > 0 ? (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-red-600 text-[9px] font-bold text-white flex items-center justify-center font-mono">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </button>
  );
}

function MetaPanel({ m }) {
  const { toast } = useToast();
  if (!m.selected) return null;
  const tagIds = m.threadTagsByThread[m.selected.id] || [];

  return (
    <aside className="hidden xl:flex w-[280px] shrink-0 min-h-0 flex-col border-l border-[var(--lt-border)] bg-[var(--lt-inner-bg)] overflow-y-auto">
      <div className="p-4 space-y-5">
        <div>
          <p className="text-[10px] font-bold text-[var(--lt-muted)] uppercase tracking-wider font-mono mb-2">Attribution</p>
          <select
            value={m.selected.assigned_user_id || ''}
            onChange={(e) =>
              void m.updateThread({
                assigned_user_id: e.target.value || null,
              })
            }
            className="w-full h-9 rounded-lg border border-[var(--lt-border)] bg-[var(--lt-card-bg)] text-sm text-[var(--lt-text)] px-2"
          >
            <option value="">Non attribué</option>
            {(m.staff || []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name || s.email} ({s.role})
              </option>
            ))}
          </select>
        </div>

        {/* Règle C-3 : une section sans donnée EXPLIQUE ce qu'elle attend — jamais de « — » nu. */}
        <div>
          <p className="text-[10px] font-bold text-[var(--lt-muted)] uppercase tracking-wider font-mono mb-2">Classification</p>
          {m.selected.classification_label ? (
            <div className="rounded-lg border border-[var(--lt-border)] bg-[var(--lt-card-bg)] p-3">
              <p className="text-sm font-semibold text-[var(--lt-text)]">{m.selected.classification_label}</p>
              <p className="text-xs text-[var(--lt-muted)] mt-1">{getSuggestedOffer(m.selected.classification_label)}</p>
              {m.selected.confidence_score != null ? (
                <>
                  <div className="h-1 rounded-full bg-black/[0.08] mt-3 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--school-accent)] transition-all"
                      style={{
                        width: `${Math.min(100, Math.round(Number(m.selected.confidence_score) * 100))}%`,
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-[var(--lt-muted)] mt-1 font-mono">
                    Confiance : {Math.round(Number(m.selected.confidence_score) * 100)}%
                  </p>
                </>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-[var(--lt-muted)] leading-relaxed">
              Pas encore classée — le bouton « Résumer IA » de la colonne analyse la boîte et propose une
              catégorie.
            </p>
          )}
        </div>

        <div>
          <p className="text-[10px] font-bold text-[var(--lt-muted)] uppercase tracking-wider font-mono mb-2">Tags</p>
          {(m.allTags || []).length === 0 ? (
            <p className="text-xs text-[var(--lt-muted)] leading-relaxed">
              Aucun tag défini pour ce tenant — les tags créés côté CRM apparaîtront ici pour étiqueter les
              fils.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {(m.allTags || []).map((tag) => {
                const on = tagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => void m.toggleTagOnThread(tag.id)}
                    className={cn(
                      'text-[10px] px-2 py-0.5 rounded-full border transition-opacity',
                      on ? 'opacity-100 border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] text-[var(--lt-gold-ink)]' : 'opacity-70 border-black/15 text-[var(--lt-sub)]'
                    )}
                    style={tag.color ? { borderColor: tag.color, color: tag.color } : undefined}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <p className="text-[10px] font-bold text-[var(--lt-muted)] uppercase tracking-wider font-mono mb-2">Actions</p>
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => void m.createOrLinkLead()}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--lt-border)] bg-[var(--lt-card-bg)] text-sm text-[var(--lt-sub)] hover:bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)] hover:border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] hover:text-[var(--lt-gold-ink)] transition-colors text-left"
            >
              <Star className="w-4 h-4 shrink-0" />
              Créer / lier un lead
            </button>
            <button
              type="button"
              onClick={() =>
                toast({
                  title: 'Rendez-vous',
                  description: "Utilisez le calendrier secrétariat et renseignez l'UUID du rendez-vous ci-dessous.",
                })
              }
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--lt-border)] bg-[var(--lt-card-bg)] text-sm text-[var(--lt-sub)] hover:opacity-80 text-left"
            >
              <Calendar className="w-4 h-4 shrink-0" />
              Rendez-vous (voir calendrier)
            </button>
            {m.selected.pipeline_status === 'to_treat' ? (
              // État ACTIF lisible (accent, pas d'aplat brun) : le fil est déjà priorisé.
              <div className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)] text-sm text-[var(--lt-gold-ink)]">
                <Flame className="w-4 h-4 shrink-0" />
                Urgent — dans « À traiter »
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void m.markUrgent()}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--lt-border)] bg-[var(--lt-card-bg)] text-sm text-[var(--lt-sub)] hover:bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)] hover:border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] hover:text-[var(--lt-gold-ink)] transition-colors text-left"
              >
                <Flame className="w-4 h-4 shrink-0" />
                Marquer urgent
              </button>
            )}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold text-[var(--lt-muted)] uppercase tracking-wider font-mono mb-2">Liaisons</p>
          <p className="text-[11px] text-[var(--lt-muted)] leading-relaxed mb-2">
            Relie ce fil à un dossier ou à un rendez-vous du calendrier secrétariat.
          </p>
          <Label className="text-xs text-[var(--lt-muted)]">Réf. Ngowazulu</Label>
          <Input
            placeholder="Ex. DOSSIER-2026-014"
            value={m.selected.ngowazulu_case_ref || ''}
            onChange={(e) => {
              const v = e.target.value;
              m.setThreads((prev) =>
                prev.map((t) => (t.id === m.selected.id ? { ...t, ngowazulu_case_ref: v || null } : t))
              );
            }}
            onBlur={(e) => void m.updateThread({ ngowazulu_case_ref: e.target.value.trim() || null })}
            className="mt-1 bg-[var(--lt-card-bg)] border-[var(--lt-border)] text-[var(--lt-text)]"
          />
          <Label className="text-xs text-[var(--lt-muted)] mt-2 block">ID rendez-vous</Label>
          <Input
            value={m.selected.appointment_id || ''}
            onChange={(e) => {
              const v = e.target.value;
              m.setThreads((prev) =>
                prev.map((t) => (t.id === m.selected.id ? { ...t, appointment_id: v || null } : t))
              );
            }}
            onBlur={(e) => void m.updateThread({ appointment_id: e.target.value.trim() || null })}
            className="mt-1 bg-[var(--lt-card-bg)] border-[var(--lt-border)] text-[var(--lt-text)] font-mono text-xs"
            placeholder="UUID du rendez-vous (calendrier)"
          />
        </div>

        <div>
          <p className="text-[10px] font-bold text-[var(--lt-muted)] uppercase tracking-wider font-mono mb-2 flex items-center gap-1">
            <Tag className="w-3 h-3" /> Notes internes
          </p>
          <Textarea
            value={m.notesDraft}
            onChange={(e) => m.setNotesDraft(e.target.value)}
            rows={4}
            placeholder="Note visible par le staff uniquement…"
            className="bg-[var(--lt-card-bg)] border-[var(--lt-border)] text-[var(--lt-text)] text-sm"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-2 w-full"
            onClick={() => void m.saveNotes()}
          >
            Enregistrer
          </Button>
        </div>
      </div>
    </aside>
  );
}

function AdminFullView({ m, syncStatusLabel, lastSync }) {
  return (
    <div className="flex-1 overflow-y-auto p-5 md:p-8">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div>
          <h3 className="text-lg font-bold text-[var(--lt-text)]">Admin Mail Control</h3>
          <p className="text-xs text-[var(--lt-muted)] font-mono">infos@ · Hostinger IMAP</p>
        </div>
        <div className="flex flex-wrap gap-2 ml-auto">
          <Button variant="outline" size="sm" className="border-[var(--lt-border)] bg-[var(--lt-card-bg)] text-[var(--lt-text)] hover:opacity-80" onClick={() => void m.runImapSync()} disabled={m.syncing}>
            {m.syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Sync maintenant
          </Button>
          <Button size="sm" className="bg-[var(--school-accent)] text-black hover:opacity-90" onClick={() => void m.load()}>
            Actualiser les données
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Messages', val: m.totalEmails },
          { label: 'Non lus (fils)', val: m.totalUnread },
          { label: 'Threads', val: m.threads.length },
          { label: 'Leads liés', val: m.leadsCount },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-card-bg)] shadow-[var(--lt-card-shadow)] p-4">
            <p className="text-2xl font-bold text-[var(--lt-text)] font-mono">{s.val}</p>
            <p className="text-[10px] uppercase tracking-wide text-[var(--lt-muted)] mt-1">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-card-bg)] shadow-[var(--lt-card-shadow)] p-5 mb-6">
        <p className="text-sm font-semibold text-[var(--lt-text)] mb-3">État de la boîte</p>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-[var(--lt-muted)]">Statut sync</span>
            <p className="text-[var(--lt-text)] font-medium mt-0.5">{syncStatusLabel}</p>
          </div>
          <div>
            <span className="text-[var(--lt-muted)]">Dernier sync</span>
            <p className="text-[var(--lt-text)] font-medium mt-0.5">{lastSync || '—'}</p>
          </div>
          {m.mailbox?.last_error ? (
            <div className="sm:col-span-2 text-red-600 text-sm">Erreur : {m.mailbox.last_error}</div>
          ) : null}
        </div>
      </div>
      <div className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-card-bg)] shadow-[var(--lt-card-shadow)] p-5">
        <p className="text-sm font-semibold text-[var(--lt-text)] mb-3">Logs récents</p>
        <ul className="text-[11px] text-[var(--lt-sub)] font-mono space-y-2 max-h-48 overflow-y-auto">
          {(m.syncLogs || []).map((log) => (
            <li key={log.id} className="flex gap-2 border-b border-[var(--lt-border)] pb-2">
              <span className="text-[var(--lt-muted)] shrink-0">{log.status}</span>
              <span className="flex-1">{log.message}</span>
              <span className="text-[var(--lt-muted)]">{log.synced_count ?? 0}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function LeadsFullView({ m }) {
  return (
    <div className="flex-1 overflow-y-auto p-5 md:p-8">
      <h3 className="text-lg font-bold text-[var(--lt-text)] mb-4">Prospects & leads (aperçu)</h3>
      {m.leadPreviewThreads.length === 0 ? (
        <p className="text-[var(--lt-muted)] text-sm">Aucun fil mis en avant pour le moment.</p>
      ) : (
        <div className="space-y-3">
          {m.leadPreviewThreads.map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-[var(--lt-border)] bg-[var(--lt-card-bg)] shadow-[var(--lt-card-shadow)] p-4"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[color-mix(in_srgb,var(--school-accent)_60%,transparent)] to-[color-mix(in_srgb,var(--school-accent)_40%,#000)] flex items-center justify-center text-white font-bold text-sm">
                {(t.primary_contact_email || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[var(--lt-text)] truncate">{t.primary_contact_email}</p>
                <p className="text-sm text-[var(--lt-sub)] truncate">{t.subject}</p>
                <p className="text-xs text-[var(--lt-muted)] mt-1">{getSuggestedOffer(t.classification_label)}</p>
              </div>
              <Button size="sm" className="bg-[var(--school-accent)] text-black hover:opacity-90" onClick={() => void m.openThread(t)}>
                Traiter
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ComposeFullView({ m }) {
  // ⚠️ VITRINE_EMAIL est un état local d'OrgMailboxPage : le lire ici sans ce hook
  // provoquait une ReferenceError au premier clic sur « Nouveau message ».
  const VITRINE_EMAIL = useVitrineContactEmail();
  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 flex flex-col items-center">
      <div className="w-full max-w-xl rounded-2xl border border-[var(--lt-border)] bg-[var(--lt-card-bg)] shadow-[var(--lt-card-shadow)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--lt-border)] flex items-center gap-2">
          <Send className="w-5 h-5 text-[var(--lt-gold-ink)]" />
          <span className="font-bold text-[var(--lt-text)]">Nouveau message</span>
          <Button variant="ghost" size="sm" className="ml-auto text-[var(--lt-sub)] hover:bg-black/[0.04]" onClick={() => m.setMailView('inbox')}>
            ×
          </Button>
        </div>
        <form
          className="p-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void m.sendMail(e);
          }}
        >
          <div>
            <Label className="text-xs text-[var(--lt-muted)] uppercase">À</Label>
            <Input
              value={m.form.to}
              onChange={(e) => m.setForm((f) => ({ ...f, to: e.target.value }))}
              className="mt-1 bg-[var(--lt-card-bg)] border-[var(--lt-border)] text-[var(--lt-text)]"
              placeholder="destinataire@…"
              required
            />
          </div>
          <div>
            <Label className="text-xs text-[var(--lt-muted)] uppercase">Sujet</Label>
            <Input
              value={m.form.subject}
              onChange={(e) => m.setForm((f) => ({ ...f, subject: e.target.value }))}
              className="mt-1 bg-[var(--lt-card-bg)] border-[var(--lt-border)] text-[var(--lt-text)]"
              required
            />
          </div>
          <div>
            <Label className="text-xs text-[var(--lt-muted)] uppercase">Message</Label>
            <Textarea
              value={m.form.text}
              onChange={(e) => m.setForm((f) => ({ ...f, text: e.target.value }))}
              rows={12}
              className="mt-1 bg-[var(--lt-card-bg)] border-[var(--lt-border)] text-[var(--lt-text)]"
              required
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Button type="submit" className="bg-[var(--school-accent)] text-black hover:opacity-90" disabled={m.sending}>
              {m.sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Envoyer via Resend'}
            </Button>
            <Button type="button" variant="outline" className="border-[var(--lt-border)] bg-[var(--lt-card-bg)] text-[var(--lt-text)] hover:opacity-80" onClick={() => m.setMailView('inbox')}>
              Annuler
            </Button>
            <span className="text-xs text-[var(--lt-muted)] ml-auto">{`De : ${VITRINE_EMAIL}`}</span>
          </div>
        </form>
      </div>
    </div>
  );
}

export default OrgMailboxPage;
