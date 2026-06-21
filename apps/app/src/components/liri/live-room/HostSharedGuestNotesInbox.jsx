/**
 * Hôte live : liste des cahiers d'élèves explicitement partagés (shared_with_teacher <> never).
 * RLS : seul le prof de la session (ou admin) voit ces lignes.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { FileText, ChevronDown, ChevronRight, Download } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

function entryPreviewText(entry) {
  const t = (entry && typeof entry.text_md === 'string') ? entry.text_md.trim() : '';
  if (!t) return '(capture ou note vide)';
  const one = t.replace(/\s+/g, ' ').slice(0, 160);
  return one.length < t.length ? `${one}…` : one;
}

export default function HostSharedGuestNotesInbox({ sessionId, maxHeight = 340 }) {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [names, setNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [panelOpen, setPanelOpen] = useState(true);

  const load = useCallback(async () => {
    if (!sessionId || !user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('live_session_guest_notes')
        .select('id, user_id, entries, shared_with_teacher, shared_at, updated_at')
        .eq('session_id', sessionId)
        .neq('shared_with_teacher', 'never')
        .order('shared_at', { ascending: false });
      if (error) throw error;
      const list = data || [];
      setRows(list);
      const ids = [...new Set(list.map((r) => r.user_id).filter(Boolean))];
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('id, name').in('id', ids);
        const map = {};
        (profs || []).forEach((p) => {
          map[p.id] = (p.name && String(p.name).trim()) || p.id;
        });
        setNames(map);
      } else {
        setNames({});
      }
    } catch (e) {
      console.warn('[HostSharedGuestNotesInbox]', e?.message || e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId, user?.id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!sessionId) return undefined;
    const ch = supabase
      .channel(`host-lsgn:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_session_guest_notes',
          filter: `session_id=eq.${sessionId}`,
        },
        () => { void load(); },
      )
      .subscribe();
    return () => {
      try { supabase.removeChannel(ch); } catch { /* noop */ }
    };
  }, [sessionId, load]);

  const downloadMarkdown = (row) => {
    const entries = Array.isArray(row.entries) ? row.entries : [];
    const title = names[row.user_id] || String(row.user_id || 'eleve');
    const body = entries.map((e) => {
      const t = e?.text_md || '';
      const ts = e?.created_at ? new Date(e.created_at).toLocaleString('fr-FR') : '';
      return `### ${ts}\n\n${t}\n`;
    }).join('\n---\n\n');
    const blob = new Blob([`# Cahier partagé — ${title}\n\n${body}`], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `notes-partagees-${title.replace(/\s+/g, '_').slice(0, 40)}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const count = rows.length;

  return (
    <div
      className="lh-premium-card lh-sp-keep"
      style={{
        border: '1px solid rgba(191,118,45,.28)',
        background:
          'radial-gradient(120% 90% at 8% -8%, rgba(191,118,45,.1), transparent 52%), linear-gradient(160deg, rgba(28,21,15,.85), rgba(24,17,11,.96))',
        padding: '11px',
      }}
    >
      <button
        type="button"
        onClick={() => {
          setPanelOpen((v) => {
            const next = !v;
            if (next) void load();
            return next;
          });
        }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          marginBottom: panelOpen ? 8 : 0,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <FileText size={14} style={{ color: '#5eead4' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#ecfdf5', letterSpacing: '.06em' }}>
            CAHIERS PARTAGÉS
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: '#0f172a',
              background: count ? '#5eead4' : 'rgba(184,166,148,.35)',
              padding: '1px 7px',
              borderRadius: 999,
            }}
          >
            {count}
          </span>
        </span>
        <span style={{ color: 'rgba(240,233,226,.5)' }}>
          {panelOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
      </button>

      {panelOpen ? (
        <div
          style={{
            maxHeight,
            overflowY: 'auto',
            scrollbarWidth: 'thin',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {loading ? (
            <p style={{ margin: 0, fontSize: 10, color: 'rgba(240,233,226,.45)' }}>Chargement…</p>
          ) : count === 0 ? (
            <p style={{ margin: 0, fontSize: 10, color: 'rgba(240,233,226,.45)', lineHeight: 1.5 }}>
              Aucun élève n'a encore envoyé son cahier. Les notes apparaissent ici après « Envoyer au prof ».
            </p>
          ) : (
            rows.map((row) => {
              const label = names[row.user_id] || `Élève ${String(row.user_id).slice(0, 8)}…`;
              const entries = Array.isArray(row.entries) ? row.entries : [];
              const isOpen = expanded[row.id];
              const sharedAt = row.shared_at
                ? new Date(row.shared_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
                : '';
              return (
                <div
                  key={row.id}
                  style={{
                    borderRadius: 8,
                    border: '1px solid rgba(191,118,45,.15)',
                    background: 'rgba(0,0,0,.22)',
                    padding: '8px 9px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setExpanded((prev) => ({ ...prev, [row.id]: !prev[row.id] }))}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        color: '#e2e8f0',
                      }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#5eead4' }}>{label}</div>
                      <div style={{ fontSize: 9, color: 'rgba(240,233,226,.4)', marginTop: 2 }}>
                        {sharedAt} · {entries.length} entrée{entries.length > 1 ? 's' : ''}
                      </div>
                    </button>
                    <button
                      type="button"
                      title="Télécharger en Markdown"
                      onClick={() => downloadMarkdown(row)}
                      style={{
                        flexShrink: 0,
                        borderRadius: 6,
                        border: '1px solid rgba(184,166,148,.25)',
                        background: 'rgba(255,255,255,.04)',
                        padding: '5px 7px',
                        cursor: 'pointer',
                        color: '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <Download size={13} />
                    </button>
                  </div>
                  {isOpen ? (
                    <ul style={{ margin: '8px 0 0', paddingLeft: 16, fontSize: 9, color: 'rgba(240,233,226,.75)', lineHeight: 1.45 }}>
                      {entries.slice().reverse().map((e, ei) => (
                        <li key={e.id || `e-${ei}-${e.created_at || ''}`} style={{ marginBottom: 6 }}>
                          {entryPreviewText(e)}
                          {Array.isArray(e.attachments) && e.attachments.some((a) => a?.url) ? (
                            <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {e.attachments.filter((a) => a?.url).map((a) => (
                                <a
                                  key={a.url}
                                  href={a.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ fontSize: 8, color: '#e3c79a' }}
                                >
                                  voir capture
                                </a>
                              ))}
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
