import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Factory,
  Loader2,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { masterFactoryApi } from '@/lib/api-v2';
import { supabase } from '@/lib/customSupabaseClient';
import { normalizeLiveSceneToSlide } from '@/lib/liveSceneNormalize';

const SOURCE_TYPES = [
  { id: 'replay', label: 'Replays' },
  { id: 'live', label: 'Lives' },
  { id: 'document', label: 'Documents' },
  { id: 'video', label: 'Vidéos' },
  { id: 'audio', label: 'Audio' },
  { id: 'texte', label: 'Textes' },
];

const unwrapList = (value) => (Array.isArray(value) ? value : (Array.isArray(value?.data) ? value.data : []));

function sourceReady(source) {
  return source?.ready !== false;
}

function pivotAvailable(status, key) {
  if (status?.[key] === true) return true;
  const pivots = status?.pivots || status?.available_pivots || status?.availablePivots || {};
  if (Array.isArray(pivots)) return pivots.some((pivot) => pivot?.kind === key);
  return pivots?.[key] === true || Boolean(pivots?.[key]?.id || pivots?.[key]?.available);
}

export default function MasterFactoryArenaImporter({ sessionId, onImported }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('replay');
  const [sources, setSources] = useState(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    setSources(null);
    setSelected(null);
    setStatus(null);
    setConfirmed(false);
    setMessage(null);
    try {
      const result = await masterFactoryApi.listSources(type);
      setSources(unwrapList(result));
    } catch (error) {
      setSources([]);
      setMessage({ kind: 'error', text: error?.message || 'Impossible de charger les projets Master Factory.' });
    }
  }, [type]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('fr');
    return (sources || []).filter((source) => !needle || String(source?.title || '').toLocaleLowerCase('fr').includes(needle));
  }, [sources, query]);

  const choose = async (source) => {
    setSelected(source);
    setStatus(null);
    setConfirmed(false);
    setMessage(null);
    setLoadingStatus(true);
    try {
      setStatus(await masterFactoryApi.status(type, String(source.id)));
    } catch (error) {
      setMessage({ kind: 'error', text: error?.message || 'État du projet indisponible.' });
    } finally {
      setLoadingStatus(false);
    }
  };

  const publish = async () => {
    if (!sessionId || !selected?.id || !confirmed || busy) return;
    setBusy(true);
    setMessage({ kind: 'info', text: 'Master Factory construit et publie le programme dans cette arène…' });
    try {
      const publication = await masterFactoryApi.publishLiveSession({
        sourceType: type,
        sourceId: String(selected.id),
        liveSessionId: sessionId,
        replaceExisting: true,
      });
      const { data: rows, error } = await supabase
        .from('live_scenes')
        .select('id,name,order_index,content_payload_json,is_active')
        .eq('live_session_id', sessionId)
        .order('order_index', { ascending: true });
      if (error) throw error;
      const scenes = (rows || []).map(normalizeLiveSceneToSlide).filter(Boolean);
      if (!scenes.length) throw new Error('La publication est terminée, mais aucune scène SmartBoard ne peut être relue.');
      await onImported?.({ publication, source: selected, sourceType: type, scenes });
      setMessage({ kind: 'success', text: `${scenes.length} scènes, la Mindmap et le Master Script sont maintenant chargés.` });
      setConfirmed(false);
    } catch (error) {
      setMessage({ kind: 'error', text: error?.message || 'Import Master Factory impossible.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Importer un projet Master Factory"
        style={{
          position: 'fixed', right: 18, top: 72, zIndex: 2147481000,
          display: 'inline-flex', alignItems: 'center', gap: 7,
          height: 36, padding: '0 13px', borderRadius: 12,
          border: '1px solid rgba(224,138,95,.42)',
          background: 'linear-gradient(135deg,rgba(63,34,24,.96),rgba(22,20,18,.96))',
          color: '#f2b08e', fontSize: 11, fontWeight: 750, letterSpacing: '.04em',
          boxShadow: '0 12px 34px rgba(0,0,0,.35)', cursor: 'pointer',
        }}
      >
        <Factory size={15} /> Master Factory
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Importer depuis Master Factory"
          style={{ position: 'fixed', inset: 0, zIndex: 2147482000, background: 'rgba(0,0,0,.64)', backdropFilter: 'blur(8px)' }}
          onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}
        >
          <aside style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 'min(470px,100vw)', background: '#151412', borderLeft: '1px solid rgba(224,138,95,.25)', boxShadow: '-24px 0 80px rgba(0,0,0,.5)', display: 'flex', flexDirection: 'column', color: '#f5f1e8' }}>
            <header style={{ padding: '20px 20px 15px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
              <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
                <span style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'rgba(217,119,87,.14)', color: '#ed946f' }}><Factory size={20} /></span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Importer un projet</p>
                  <p style={{ margin: '5px 0 0', fontSize: 11.5, lineHeight: 1.45, color: 'rgba(255,255,255,.48)' }}>La même intelligence publie la Mindmap, le Master Script et les scènes SmartBoard dans ce live.</p>
                </div>
                <button type="button" aria-label="Fermer" disabled={busy} onClick={() => setOpen(false)} style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(255,255,255,.09)', background: 'transparent', color: 'rgba(255,255,255,.55)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><X size={16} /></button>
              </div>
            </header>

            <div style={{ padding: '13px 16px 0', display: 'flex', gap: 6, overflowX: 'auto' }}>
              {SOURCE_TYPES.map((item) => (
                <button key={item.id} type="button" onClick={() => setType(item.id)} style={{ borderRadius: 999, border: `1px solid ${type === item.id ? 'rgba(224,138,95,.5)' : 'rgba(255,255,255,.09)'}`, background: type === item.id ? 'rgba(217,119,87,.16)' : 'transparent', color: type === item.id ? '#f0a17f' : 'rgba(255,255,255,.5)', padding: '7px 10px', fontSize: 10.5, whiteSpace: 'nowrap', cursor: 'pointer' }}>{item.label}</button>
              ))}
            </div>

            <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
              <label style={{ flex: 1, height: 36, display: 'flex', alignItems: 'center', gap: 8, padding: '0 11px', border: '1px solid rgba(255,255,255,.09)', borderRadius: 10, background: 'rgba(0,0,0,.22)' }}>
                <Search size={14} color="rgba(255,255,255,.35)" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un projet…" style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', color: '#fff', fontSize: 12 }} />
              </label>
              <button type="button" aria-label="Actualiser" onClick={() => void load()} style={{ width: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,.09)', background: 'transparent', color: 'rgba(255,255,255,.55)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><RefreshCw size={14} /></button>
            </div>

            <div style={{ minHeight: 0, flex: 1, overflowY: 'auto', padding: '0 16px 14px' }}>
              {sources === null ? <div style={{ padding: 28, textAlign: 'center', color: 'rgba(255,255,255,.45)' }}><Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 8px' }} />Chargement des projets…</div> : null}
              {sources !== null && filtered.length === 0 ? <p style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,.4)', fontSize: 12 }}>Aucune source disponible.</p> : null}
              {filtered.map((source) => {
                const active = selected?.id === source.id;
                const ready = sourceReady(source);
                return (
                  <button key={source.id} type="button" onClick={() => void choose(source)} style={{ width: '100%', marginBottom: 7, padding: '11px 12px', textAlign: 'left', borderRadius: 12, border: `1px solid ${active ? 'rgba(224,138,95,.5)' : 'rgba(255,255,255,.07)'}`, background: active ? 'rgba(217,119,87,.11)' : 'rgba(255,255,255,.025)', color: '#fff', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
                      {ready ? <CheckCircle2 size={14} color="#7bb06a" /> : <AlertTriangle size={14} color="#d9a441" />}
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12.5, fontWeight: 650 }}>{source.title || 'Projet sans titre'}</span>
                      {Number(source.chars || 0) > 0 ? <span style={{ fontSize: 10, color: 'rgba(255,255,255,.34)' }}>{(Number(source.chars) / 1000).toFixed(1)}k</span> : null}
                    </div>
                  </button>
                );
              })}

              {selected ? (
                <section style={{ marginTop: 10, padding: 13, borderRadius: 13, border: '1px solid rgba(224,138,95,.2)', background: 'rgba(217,119,87,.055)' }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#eca080', textTransform: 'uppercase', letterSpacing: '.08em' }}>Aperçu du pipeline</p>
                  <p style={{ margin: '6px 0 0', fontSize: 12.5, fontWeight: 700, color: 'rgba(255,255,255,.82)' }}>{selected.title || 'Projet sans titre'}</p>
                  {loadingStatus ? <p style={{ margin: '10px 0 0', fontSize: 11, color: 'rgba(255,255,255,.45)' }}>Lecture des pivots…</p> : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                      {[
                        ['Compréhension', 'comprehension'], ['Cours', 'ecrit'], ['Script', 'master_script'],
                        ['SmartBoard', 'smartboard_timeline'], ['LIVE', 'live_scenario'],
                      ].map(([label, key]) => {
                        const available = pivotAvailable(status, key);
                        return <span key={key} style={{ borderRadius: 999, padding: '5px 8px', border: `1px solid ${available ? 'rgba(123,176,106,.28)' : 'rgba(255,255,255,.08)'}`, color: available ? '#a9cf9d' : 'rgba(255,255,255,.35)', background: available ? 'rgba(90,143,82,.1)' : 'transparent', fontSize: 9.5 }}>{available ? '✓ ' : '○ '}{label}</span>;
                      })}
                    </div>
                  )}
                  <label style={{ display: 'flex', gap: 9, alignItems: 'start', marginTop: 13, fontSize: 11, lineHeight: 1.45, color: 'rgba(255,255,255,.6)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} style={{ marginTop: 2, accentColor: '#d97757' }} />
                    Remplacer les scènes et le script actuels de cette session. Le lien du live et les invités restent inchangés.
                  </label>
                </section>
              ) : null}

            </div>

            <footer style={{ padding: 15, borderTop: '1px solid rgba(255,255,255,.08)' }}>
              {message ? <p role="status" style={{ margin: '0 0 10px', padding: '10px 12px', borderRadius: 10, fontSize: 11, lineHeight: 1.45, color: message.kind === 'error' ? '#f39a92' : message.kind === 'success' ? '#a8d29a' : '#e5b37b', background: message.kind === 'error' ? 'rgba(180,55,55,.12)' : message.kind === 'success' ? 'rgba(76,135,63,.12)' : 'rgba(180,125,55,.12)' }}>{message.text}</p> : null}
              <button type="button" onClick={() => void publish()} disabled={!selected || !confirmed || busy || !sourceReady(selected)} style={{ width: '100%', height: 42, borderRadius: 12, border: '1px solid rgba(224,138,95,.45)', background: 'linear-gradient(90deg,#a94f36,#d97757)', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer', opacity: !selected || !confirmed || busy || !sourceReady(selected) ? .42 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Factory size={15} />}
                {busy ? 'Construction du live…' : 'Importer et remplacer le programme'}
              </button>
            </footer>
          </aside>
        </div>
      ) : null}
    </>
  );
}
