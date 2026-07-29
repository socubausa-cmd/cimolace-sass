import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  // 400 « Un direct est en cours » : l'API refuse le publish tant que l'hôte n'a
  // pas explicitement accepté de remplacer le programme sous les yeux des invités.
  const [liveOverrideAsk, setLiveOverrideAsk] = useState(false);
  // Garde double-clic SYNCHRONE : l'état React `busy` n'est commité qu'au render
  // suivant — deux clics dans la même frame passaient tous les deux la garde.
  const busyRef = useRef(false);
  const searchInputRef = useRef(null);

  // Accessibilité minimale du tiroir : Escape ferme (hors publication en cours),
  // et le focus arrive sur la recherche à l'ouverture.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape' && !busyRef.current) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    searchInputRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const load = useCallback(async () => {
    setSources(null);
    setSelected(null);
    setStatus(null);
    setConfirmed(false);
    setMessage(null);
    setLiveOverrideAsk(false);
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
    return (sources || []).filter((source) => {
      // La session en cours ne peut pas être sa propre source d'import (boucle :
      // on publierait dans l'arène le contenu qu'on est en train de remplacer).
      if (type === 'live' && String(source?.id) === String(sessionId)) return false;
      return !needle || String(source?.title || '').toLocaleLowerCase('fr').includes(needle);
    });
  }, [sources, query, type, sessionId]);

  const choose = async (source) => {
    setSelected(source);
    setStatus(null);
    setConfirmed(false);
    setMessage(null);
    setLiveOverrideAsk(false);
    setLoadingStatus(true);
    try {
      setStatus(await masterFactoryApi.status(type, String(source.id)));
    } catch (error) {
      setMessage({ kind: 'error', text: error?.message || 'État du projet indisponible.' });
    } finally {
      setLoadingStatus(false);
    }
  };

  /** Relit scènes + config de la session (source de vérité après publication atomique). */
  const readBackSession = async () => {
    const [{ data: rows, error }, { data: sessRow }] = await Promise.all([
      supabase
        .from('live_scenes')
        .select('id,name,order_index,content_payload_json,is_active')
        .eq('live_session_id', sessionId)
        .order('order_index', { ascending: true }),
      supabase.from('live_sessions').select('config').eq('id', sessionId).maybeSingle(),
    ]);
    if (error) throw error;
    let cfg = {};
    try {
      cfg = typeof sessRow?.config === 'string' ? JSON.parse(sessRow.config) : (sessRow?.config || {});
    } catch { cfg = {}; }
    return {
      scenes: (rows || []).map(normalizeLiveSceneToSlide).filter(Boolean),
      // Le publish écrit le vrai Master Script dans la config — on le remonte au
      // prompteur de l'arène plutôt que de laisser le mock en place.
      scriptSections: Array.isArray(cfg?.smartboard_master_script_sections)
        ? cfg.smartboard_master_script_sections
        : [],
    };
  };

  const publish = async ({ allowDuringLive = false } = {}) => {
    // busyRef = garde synchrone (double-clic dans la même frame) ; busy = état d'affichage.
    if (!sessionId || !selected?.id || !confirmed || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setLiveOverrideAsk(false);
    setMessage({ kind: 'info', text: 'Master Factory construit et publie le programme dans cette arène…' });
    try {
      const publication = await masterFactoryApi.publishLiveSession({
        sourceType: type,
        sourceId: String(selected.id),
        liveSessionId: sessionId,
        replaceExisting: true,
        allowDuringLive,
      });
      const { scenes, scriptSections } = await readBackSession();
      if (!scenes.length) throw new Error('La publication est terminée, mais aucune scène SmartBoard ne peut être relue.');
      await onImported?.({ publication, source: selected, sourceType: type, scenes, scriptSections });
      // Message honnête : on n'affirme que ce qui vient réellement d'être rechargé ici.
      setMessage({
        kind: 'success',
        text: `${scenes.length} scènes SmartBoard chargées${scriptSections.length ? ' et prompteur mis à jour' : ''}.`,
      });
      setConfirmed(false);
      // Succès : refermer le tiroir — pas d'overlay flouté plein écran en plein direct.
      setOpen(false);
    } catch (error) {
      const msg = error?.message || 'Import Master Factory impossible.';
      // 400 explicite de l'API : un direct est en cours sur cette session → seconde
      // confirmation avant de relancer avec allowDuringLive (la case reste cochée,
      // l'hôte tranche via le bandeau dédié).
      if (!allowDuringLive && /direct est en cours/i.test(msg)) {
        setLiveOverrideAsk(true);
        setMessage({ kind: 'info', text: msg });
      } else {
        setConfirmed(false);
        // Erreur APRÈS l'appel publish (timeout, relecture…) : la base a peut-être
        // déjà été remplacée. On tente une resynchronisation plutôt qu'un échec sec.
        let resynced = false;
        try {
          const { scenes, scriptSections } = await readBackSession();
          if (scenes.length) {
            await onImported?.({ source: selected, sourceType: type, scenes, scriptSections, resynced: true });
            setMessage({
              kind: 'info',
              text: `L'import a rencontré une erreur (${msg}), mais ${scenes.length} scènes existent en base — l'arène a été resynchronisée avec ce contenu.`,
            });
            resynced = true;
          }
        } catch { /* la resynchronisation est un filet, pas une exigence */ }
        if (!resynced) setMessage({ kind: 'error', text: msg });
      }
    } finally {
      busyRef.current = false;
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
                  <p style={{ margin: '5px 0 0', fontSize: 11.5, lineHeight: 1.45, color: 'rgba(255,255,255,.48)' }}>Publie les scènes SmartBoard et le script du prompteur de ce live depuis un projet Master Factory.</p>
                </div>
                <button type="button" aria-label="Fermer" disabled={busy} onClick={() => setOpen(false)} style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(255,255,255,.09)', background: 'transparent', color: 'rgba(255,255,255,.55)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><X size={16} /></button>
              </div>
            </header>

            <div style={{ padding: '13px 16px 0', display: 'flex', gap: 6, overflowX: 'auto' }}>
              {SOURCE_TYPES.map((item) => (
                <button key={item.id} type="button" aria-pressed={type === item.id} onClick={() => setType(item.id)} style={{ borderRadius: 999, border: `1px solid ${type === item.id ? 'rgba(224,138,95,.5)' : 'rgba(255,255,255,.09)'}`, background: type === item.id ? 'rgba(217,119,87,.16)' : 'transparent', color: type === item.id ? '#f0a17f' : 'rgba(255,255,255,.5)', padding: '7px 10px', fontSize: 10.5, whiteSpace: 'nowrap', cursor: 'pointer' }}>{item.label}</button>
              ))}
            </div>

            <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
              <label style={{ flex: 1, height: 36, display: 'flex', alignItems: 'center', gap: 8, padding: '0 11px', border: '1px solid rgba(255,255,255,.09)', borderRadius: 10, background: 'rgba(0,0,0,.22)' }}>
                <Search size={14} color="rgba(255,255,255,.35)" />
                <input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un projet…" style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', color: '#fff', fontSize: 12 }} />
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
                  <button key={source.id} type="button" aria-pressed={active} onClick={() => void choose(source)} style={{ width: '100%', marginBottom: 7, padding: '11px 12px', textAlign: 'left', borderRadius: 12, border: `1px solid ${active ? 'rgba(224,138,95,.5)' : 'rgba(255,255,255,.07)'}`, background: active ? 'rgba(217,119,87,.11)' : 'rgba(255,255,255,.025)', color: '#fff', cursor: 'pointer' }}>
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
              {liveOverrideAsk ? (
                <div style={{ margin: '0 0 10px', padding: '11px 12px', borderRadius: 10, border: '1px solid rgba(217,164,65,.4)', background: 'rgba(180,125,55,.1)' }}>
                  <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: '#e5b37b' }}>
                    Un direct est en cours sur cette session : les invités connectés verront le programme (scènes et prompteur) remplacé immédiatement. Continuer quand même ?
                  </p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
                    <button type="button" disabled={busy} onClick={() => void publish({ allowDuringLive: true })} style={{ flex: 1, height: 34, borderRadius: 10, border: '1px solid rgba(217,164,65,.5)', background: 'rgba(217,164,65,.16)', color: '#f0cd8f', fontWeight: 750, fontSize: 11, cursor: 'pointer' }}>
                      Remplacer pendant le direct
                    </button>
                    <button type="button" disabled={busy} onClick={() => { setLiveOverrideAsk(false); setConfirmed(false); setMessage(null); }} style={{ height: 34, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: 'rgba(255,255,255,.6)', fontSize: 11, cursor: 'pointer' }}>
                      Annuler
                    </button>
                  </div>
                </div>
              ) : null}
              <button type="button" onClick={() => void publish()} disabled={!selected || !confirmed || busy || liveOverrideAsk || !sourceReady(selected)} style={{ width: '100%', height: 42, borderRadius: 12, border: '1px solid rgba(224,138,95,.45)', background: 'linear-gradient(90deg,#a94f36,#d97757)', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer', opacity: !selected || !confirmed || busy || liveOverrideAsk || !sourceReady(selected) ? .42 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
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
