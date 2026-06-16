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

function pipelineBadgeClass(status) {
  switch (status) {
    case 'new':
      return 'bg-violet-50 text-violet-700 border-violet-200';
    case 'in_progress':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'to_treat':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'converted':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'closed':
      return 'bg-zinc-100 text-zinc-600 border-zinc-200';
    default:
      return 'bg-zinc-100 text-zinc-600 border-zinc-200';
  }
}

/**
 * Courrier infos@ — UI type Mail CRM (dossier messagerie) + thème premium secrétariat (sombre / or).
 * @param {{ embedded?: boolean }} props — si true (messagerie unifiée), en-tête compact sans doublon de page.
 */
const OrgMailboxPage = ({ embedded = false }) => {
  const VITRINE_EMAIL = useVitrineContactEmail();
  const m = useOrgMailbox();

  const syncStatusLabel = m.mailbox?.sync_status || '—';
  const lastSync =
    m.mailbox?.last_synced_at && format(new Date(m.mailbox.last_synced_at), 'PPp', { locale: fr });

  return (
    <div className={cn('w-full max-w-[1600px] mx-auto', !embedded && '-mt-1')}>
      {/* Titre section (masqué ou compact en mode messagerie unifiée) */}
      {!embedded ? (
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-[var(--lt-text)] flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--school-accent)] to-amber-600 text-black font-bold text-sm shadow-sm">
                ✦
              </span>
              {`Mail CRM — ${VITRINE_EMAIL}`}
            </h2>
            <p className="text-sm text-[var(--lt-sub)] mt-1">
              IMAP Hostinger · Supabase · envoi Resend — même expérience que le reste du secrétariat
            </p>
          </div>
        </div>
      ) : (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-[var(--lt-sub)]">
            <span className="text-[var(--lt-gold-ink)] font-mono font-medium">{VITRINE_EMAIL}</span>
            <span className="mx-2 text-black/20">·</span>
            IMAP → Supabase · envoi Resend
          </p>
        </div>
      )}

      <div
        className={cn(
          'flex flex-col lg:flex-row rounded-[14px] border border-[var(--lt-border)] bg-[var(--lt-card-bg)] overflow-hidden shadow-[var(--lt-card-shadow)]',
          embedded
            ? 'min-h-[min(640px,calc(100vh-14rem))] h-[min(720px,calc(100vh-12rem))]'
            : 'min-h-[min(780px,calc(100vh-10rem))] h-[min(780px,calc(100vh-10rem))]'
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
              <div className="px-4 pt-4 pb-2 border-b border-[var(--lt-border)]">
                <p className="text-sm font-bold text-[var(--lt-text)]">Conversations</p>
                <p className="text-[11px] text-[var(--lt-muted)] font-mono mt-0.5">{VITRINE_EMAIL}</p>
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
                {FILTER_PILLS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => m.setFilterPipeline(f.value)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors',
                      m.filterPipeline === f.value
                        ? 'bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] text-[var(--lt-gold-ink)]'
                        : 'border-[var(--lt-border)] bg-[var(--lt-card-bg)] text-[var(--lt-sub)] hover:border-black/25 hover:text-[var(--lt-text)]'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                {m.loading ? (
                  <div className="p-10 flex justify-center">
                    <Loader2 className="w-7 h-7 animate-spin text-[var(--lt-gold-ink)]" />
                  </div>
                ) : m.filteredThreads.length === 0 ? (
                  <div className="p-8 text-center text-sm text-[var(--lt-muted)]">Aucun fil — lancez une sync IMAP.</div>
                ) : (
                  m.filteredThreads.map((t) => {
                    const last = (m.emailsByThread[t.id] || []).slice(-1)[0];
                    const unread = m.unreadInThread(t.id);
                    const rel =
                      last?.received_at &&
                      formatDistanceToNow(new Date(last.received_at), { addSuffix: true, locale: fr });
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => void m.openThread(t)}
                        className={cn(
                          'w-full text-left px-3 py-3 border-b border-[var(--lt-border)] hover:bg-black/[0.03] transition-colors relative',
                          m.selectedId === t.id && 'bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] border-l-2 border-l-[var(--school-accent)] pl-[10px]',
                          unread > 0 && m.selectedId !== t.id && 'border-l-2 border-l-violet-500/60'
                        )}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span
                            className={cn(
                              'text-xs truncate flex-1',
                              unread ? 'font-semibold text-[var(--lt-text)]' : 'text-[var(--lt-sub)]'
                            )}
                          >
                            {t.primary_contact_email || '—'}
                          </span>
                          <span className="text-[10px] text-[var(--lt-muted)] shrink-0">{rel || ''}</span>
                        </div>
                        <p className={cn('text-[13px] truncate', unread ? 'text-[var(--lt-text)] font-medium' : 'text-[var(--lt-sub)]')}>
                          {t.subject || '(Sans objet)'}
                        </p>
                        <p className="text-[11px] text-[var(--lt-muted)] mt-0.5 line-clamp-1">{last?.snippet || '—'}</p>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          <span
                            className={cn(
                              'text-[10px] px-2 py-0 rounded-full border',
                              pipelineBadgeClass(t.pipeline_status)
                            )}
                          >
                            {PIPELINE.find((p) => p.value === t.pipeline_status)?.label || t.pipeline_status}
                          </span>
                          {t.classification_label ? (
                            <Badge variant="outline" className="text-[9px] h-5 border-violet-500/30 text-violet-200">
                              <Sparkles className="w-3 h-3 mr-0.5" />
                              {t.classification_label}
                            </Badge>
                          ) : null}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
              <div className="p-3 border-t border-[var(--lt-border)] space-y-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-[var(--lt-border)] bg-[var(--lt-card-bg)] text-[var(--lt-text)] hover:opacity-80 justify-center gap-2"
                  onClick={() => void m.runImapSync()}
                  disabled={m.loading || m.syncing || !m.session}
                >
                  {m.syncing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Synchroniser
                </Button>
                <p className="text-[10px] text-center text-[var(--lt-muted)] font-mono">
                  {m.mailbox?.last_synced_at ? `Dernier sync : ${lastSync}` : 'Pas encore synchronisé'}
                </p>
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
                  <div className="flex-1 flex flex-col min-w-0 min-h-0">
                    {/* Top bar fil */}
                    <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-[var(--lt-border)] bg-[var(--lt-inner-bg)] shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[var(--lt-sub)] hover:bg-black/[0.04] xl:hidden"
                        onClick={() => m.setSelectedId(null)}
                      >
                        <ArrowLeft className="w-4 h-4 mr-1" /> Liste
                      </Button>
                      <p className="text-sm font-semibold text-[var(--lt-text)] truncate flex-1 min-w-0">
                        {m.selected.subject || '(Sans objet)'}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-[var(--lt-border)] bg-[var(--lt-card-bg)] text-[var(--lt-text)] hover:opacity-80 h-8 text-xs"
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

                    {/* En-tête contact */}
                    <div className="px-5 py-4 border-b border-[var(--lt-border)] bg-[var(--lt-inner-bg)] shrink-0">
                      <h3 className="text-lg font-bold text-[var(--lt-text)] leading-tight">{m.selected.subject || '(Sans objet)'}</h3>
                      <div className="flex flex-wrap items-center gap-3 mt-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{
                            background:
                              'linear-gradient(135deg, rgba(212,175,55,.9), rgba(124,58,237,.85))',
                          }}
                        >
                          {m.contactInitials(m.selected)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--lt-text)] truncate">
                            {m.selected.primary_contact_email ? 'Contact' : '—'}
                          </p>
                          <p className="text-xs text-[var(--lt-muted)] truncate">{m.selected.primary_contact_email}</p>
                        </div>
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

                    {/* Timeline messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                      {m.threadTimeline.length === 0 ? (
                        <p className="text-sm text-[var(--lt-muted)]">Aucun message.</p>
                      ) : (
                        m.threadTimeline.map((item) =>
                          item.kind === 'in' ? (
                            <div
                              key={`in-${item.data.id}`}
                              className={cn(
                                'rounded-xl border overflow-hidden',
                                item.data.is_read
                                  ? 'border-[var(--lt-border)] bg-[var(--lt-card-bg)]'
                                  : 'border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_8%,transparent)]'
                              )}
                            >
                              <div className="px-4 py-2.5 bg-[var(--lt-inner-bg)] border-b border-[var(--lt-border)] flex flex-wrap gap-2 text-[11px] text-[var(--lt-muted)]">
                                <span className="text-[var(--lt-text)] font-medium">
                                  {item.data.from_name || item.data.from_email}
                                </span>
                                <span className="truncate">{item.data.from_email}</span>
                                <span className="ml-auto shrink-0">
                                  {item.data.received_at
                                    ? format(new Date(item.data.received_at), 'PPp', { locale: fr })
                                    : ''}
                                </span>
                              </div>
                              <div className="p-4 text-sm text-[var(--lt-sub)] max-h-[320px] overflow-y-auto">
                                {item.data.body_html ? (
                                  // Email ENTRANT = non fiable. Double défense :
                                  // 1) DOMPurify assainit le HTML ;
                                  // 2) rendu dans une <iframe sandbox> SANS allow-scripts
                                  //    (isolation d'origine, aucun JS exécuté).
                                  <iframe
                                    title={`Email de ${item.data.from_email || 'expéditeur inconnu'}`}
                                    sandbox=""
                                    referrerPolicy="no-referrer"
                                    className="w-full min-h-[200px] bg-white rounded-md"
                                    srcDoc={`<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>body{margin:0;padding:8px;font:14px/1.5 system-ui,sans-serif;color:#111;word-break:break-word}img{max-width:100%;height:auto}a{color:#1d4ed8}</style></head><body>${DOMPurify.sanitize(
                                      String(item.data.body_html || ''),
                                      { USE_PROFILES: { html: true } }
                                    )}</body></html>`}
                                  />
                                ) : (
                                  <pre className="whitespace-pre-wrap font-sans text-[var(--lt-sub)]">
                                    {item.data.body_text || '—'}
                                  </pre>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div
                              key={`out-${item.data.id}`}
                              className="rounded-xl border border-emerald-200 bg-emerald-50 overflow-hidden"
                            >
                              <div className="px-4 py-2 flex justify-between text-[11px] text-emerald-700">
                                <span className="font-medium">Envoyé (Resend)</span>
                                <span>
                                  {item.data.sent_at
                                    ? format(new Date(item.data.sent_at), 'PPp', { locale: fr })
                                    : item.data.created_at}
                                </span>
                              </div>
                              <div className="px-4 pb-3 text-sm text-[#3f3f46]">
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
                              className="bg-[var(--school-accent)] text-black hover:bg-[#c4a032]"
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
    <aside className="hidden xl:flex w-[280px] shrink-0 flex-col border-l border-[var(--lt-border)] bg-[var(--lt-inner-bg)] overflow-y-auto">
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

        <div>
          <p className="text-[10px] font-bold text-[var(--lt-muted)] uppercase tracking-wider font-mono mb-2">Classification</p>
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
            <p className="text-sm font-semibold text-[var(--lt-text)]">
              {m.selected.classification_label || '—'}
            </p>
            <p className="text-xs text-[var(--lt-muted)] mt-1">{getSuggestedOffer(m.selected.classification_label)}</p>
            <div className="h-1 rounded-full bg-black/[0.08] mt-3 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-[var(--school-accent)] transition-all"
                style={{
                  width: `${Math.min(100, Math.round(Number(m.selected.confidence_score || 0) * 100))}%`,
                }}
              />
            </div>
            <p className="text-[10px] text-[var(--lt-muted)] mt-1 font-mono">
              Confiance :{' '}
              {m.selected.confidence_score != null
                ? `${Math.round(Number(m.selected.confidence_score) * 100)}%`
                : '—'}
            </p>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold text-[var(--lt-muted)] uppercase tracking-wider font-mono mb-2">Tags</p>
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
            <button
              type="button"
              onClick={() => void m.markUrgent()}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--lt-border)] bg-[var(--lt-card-bg)] text-sm text-[var(--lt-sub)] hover:bg-amber-50 hover:border-amber-300 text-left"
            >
              <Flame className="w-4 h-4 shrink-0" />
              Marquer urgent
            </button>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold text-[var(--lt-muted)] uppercase tracking-wider font-mono mb-2">Liaisons</p>
          <Label className="text-xs text-[var(--lt-muted)]">Réf. Ngowazulu</Label>
          <Input
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
            placeholder="UUID"
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
            className="bg-amber-50 border-amber-200 text-[var(--lt-text)] text-sm"
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
          <Button size="sm" className="bg-[var(--school-accent)] text-black hover:bg-amber-500" onClick={() => void m.load()}>
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
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[color-mix(in_srgb,var(--school-accent)_60%,transparent)] to-violet-500 flex items-center justify-center text-white font-bold text-sm">
                {(t.primary_contact_email || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[var(--lt-text)] truncate">{t.primary_contact_email}</p>
                <p className="text-sm text-[var(--lt-sub)] truncate">{t.subject}</p>
                <p className="text-xs text-[var(--lt-muted)] mt-1">{getSuggestedOffer(t.classification_label)}</p>
              </div>
              <Button size="sm" className="bg-[var(--school-accent)] text-black hover:bg-amber-500" onClick={() => void m.openThread(t)}>
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
            <Button type="submit" className="bg-[var(--school-accent)] text-black hover:bg-amber-500" disabled={m.sending}>
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
