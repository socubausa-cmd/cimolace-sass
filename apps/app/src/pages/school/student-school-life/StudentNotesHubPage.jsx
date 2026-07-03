import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotebookPen, BookOpen, Video, GraduationCap, ChevronDown, ArrowUpRight, Search } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { themeProxy as T, useSslThemeMode } from './sslTheme';
import { listStudentNotes, noteSourceLink, NOTE_SOURCES } from '@/lib/liri/studentNotes';

/**
 * Hub « Mes notes » — la prise de notes de l'élève, rattachée à sa SOURCE.
 * Les notes viennent des COURS, des LIVES (replays) et du PRÉCEPTEUR. Filtre par source
 * + clic → note complète + lien vers l'origine. (Le bulletin/grades vit désormais dans « Évals ».)
 *
 * Style sobre/chaud : surfaces neutres, l'accent coral ne porte que la SÉLECTION active.
 */

const SOURCE_META = {
  course: { label: 'Cours', Icon: BookOpen },
  live: { label: 'Live', Icon: Video },
  precepteur: { label: 'Précepteur', Icon: GraduationCap },
};

function fmtWhen(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
}

function SourceBadge({ type }) {
  const meta = SOURCE_META[type] || SOURCE_META.course;
  const { Icon } = meta;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase',
      color: T.t2, background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.border}`,
      borderRadius: 20, padding: '2px 9px', whiteSpace: 'nowrap',
    }}>
      <Icon size={12} /> {meta.label}
    </span>
  );
}

function NoteCard({ note, expanded, onToggle, onOpen }) {
  const [hov, setHov] = useState(false);
  const link = noteSourceLink(note);
  const title = note.source_title || SOURCE_META[note.source_type]?.label || 'Note';
  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: hov || expanded ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.18)',
        border: `1px solid ${hov || expanded ? T.goldMid : T.border}`, borderRadius: 14,
        transition: 'all 160ms ease', overflow: 'hidden',
      }}>
      <button
        onClick={() => onToggle(note.id)}
        style={{
          width: '100%', display: 'flex', alignItems: 'flex-start', gap: 13, padding: '14px 16px',
          background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'inherit',
        }}>
        <span style={{
          display: 'grid', placeItems: 'center', width: 40, height: 40, borderRadius: 11, flexShrink: 0,
          background: 'rgba(0,0,0,0.22)', border: `1px solid ${T.border}`,
        }}>
          <NotebookPen size={18} color={T.goldText} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <SourceBadge type={note.source_type} />
            <span style={{ fontSize: 14.5, fontWeight: 600, color: T.t1, minWidth: 0 }}>{title}</span>
          </span>
          <span style={{
            display: 'block', fontSize: 13, color: T.t2, lineHeight: 1.5,
            ...(expanded ? {} : { overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }),
          }}>
            {note.content}
          </span>
          <span style={{ display: 'block', marginTop: 6, fontSize: 11.5, color: T.t3 }}>{fmtWhen(note.updated_at)}</span>
        </span>
        <ChevronDown size={16} color={T.t3} style={{ flexShrink: 0, marginTop: 10, transition: 'transform 180ms ease', transform: expanded ? 'rotate(180deg)' : 'none' }} />
      </button>
      {expanded && link && (
        <div style={{ padding: '0 16px 14px 69px' }}>
          <button
            onClick={() => onOpen(link)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600,
              color: T.goldText, background: T.goldDim, border: `1px solid ${T.goldMid}`,
              borderRadius: 10, padding: '7px 12px', cursor: 'pointer',
            }}>
            Ouvrir {(SOURCE_META[note.source_type]?.label || 'la source').toLowerCase()} d'origine <ArrowUpRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function StudentNotesHubPage() {
  const isLight = useSslThemeMode() === 'light';
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.id) { setStatus('ready'); setNotes([]); return; }
      try {
        const rows = await listStudentNotes(user.id);
        if (alive) { setNotes(rows); setStatus('ready'); }
      } catch {
        if (alive) setStatus('error');
      }
    })();
    return () => { alive = false; };
  }, [user?.id]);

  const counts = useMemo(() => {
    const c = { all: notes.length, course: 0, live: 0, precepteur: 0 };
    notes.forEach((n) => { c[n.source_type] = (c[n.source_type] || 0) + 1; });
    return c;
  }, [notes]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((n) => {
      if (filter !== 'all' && n.source_type !== filter) return false;
      if (!q) return true;
      return (n.content || '').toLowerCase().includes(q) || (n.source_title || '').toLowerCase().includes(q);
    });
  }, [notes, filter, query]);

  const pageBg = isLight ? T.bg : 'transparent';
  const chips = [
    { key: 'all', label: 'Toutes' },
    ...Object.values(NOTE_SOURCES).map((s) => ({ key: s.key, label: s.label })),
  ];

  return (
    <div style={{ minHeight: '100%', background: pageBg, color: T.t1, paddingBottom: 8 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14, background: T.goldDim, border: `1px solid ${T.goldMid}`,
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <NotebookPen size={22} color={T.gold} />
        </div>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: T.t1, letterSpacing: '-0.02em', margin: 0 }}>Mes notes</h1>
          <p style={{ fontSize: 13, color: T.t3, marginTop: 3 }}>Tes notes prises en cours, en live et avec le Précepteur — rattachées à leur source.</p>
        </div>
      </div>

      {/* Barre : filtre par source + recherche */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {chips.map((chip) => {
            const active = filter === chip.key;
            const n = counts[chip.key] || 0;
            return (
              <button key={chip.key} onClick={() => setFilter(chip.key)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  background: active ? T.goldDim : 'transparent',
                  border: `1px solid ${active ? T.goldMid : T.border}`, borderRadius: 999,
                  padding: '7px 14px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
                  color: active ? T.gold : T.t2, cursor: 'pointer', transition: 'all 160ms ease',
                }}>
                {chip.label}
                {n > 0 && (
                  <span style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 700, color: T.gold, background: active ? 'rgba(217,119,87,0.22)' : T.goldDim, borderRadius: 999, padding: '0 6px', minWidth: 16, textAlign: 'center' }}>{n}</span>
                )}
              </button>
            );
          })}
        </div>
        <div style={{ position: 'relative', marginLeft: 'auto', flex: '1 1 200px', maxWidth: 320 }}>
          <Search size={15} color={T.t3} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher une note…"
            style={{
              width: '100%', background: 'rgba(0,0,0,0.22)', border: `1px solid ${T.border}`, borderRadius: 12,
              padding: '9px 12px 9px 34px', fontSize: 13, color: T.t1, fontFamily: 'inherit', outline: 'none',
            }} />
        </div>
      </div>

      {/* Liste */}
      {status === 'loading' && <div style={{ padding: '40px 0', textAlign: 'center', color: T.t3, fontSize: 13 }}>Chargement…</div>}
      {status === 'error' && <div style={{ padding: '40px 0', textAlign: 'center', color: T.danger, fontSize: 13 }}>Impossible de charger tes notes.</div>}
      {status === 'ready' && visible.length === 0 && (
        <div style={{ padding: '48px 20px', textAlign: 'center', background: 'rgba(0,0,0,0.16)', border: `1px dashed ${T.border}`, borderRadius: 16 }}>
          <NotebookPen size={26} color={T.t3} style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14.5, fontWeight: 600, color: T.t1 }}>Aucune note pour l'instant</div>
          <div style={{ fontSize: 13, color: T.t3, marginTop: 4 }}>Prends des notes pendant un cours, un live ou avec le Précepteur — elles apparaîtront ici, reliées à leur source.</div>
        </div>
      )}
      {status === 'ready' && visible.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map((note) => (
            <NoteCard
              key={note.id} note={note}
              expanded={openId === note.id}
              onToggle={(id) => setOpenId((cur) => (cur === id ? null : id))}
              onOpen={(link) => navigate(link)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
