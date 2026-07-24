import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Play, BookOpen, ChevronDown, ExternalLink, Sparkles } from 'lucide-react';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import { precepteurLibraryApi } from '@/lib/api-v2';

/**
 * BIBLIOTHÈQUE DU PRÉCEPTEUR — les cours générés par l'agent depuis les vidéos TikTok du
 * fondateur (@manikongo5). Chaque carte = un cours (title + concepts) + son MANUEL
 * D'ENSEIGNEMENT (markdown, repliable). « Suivre ce cours » pose le cours dans
 * localStorage['precepteur:sourceCourse'] puis ouvre le lecteur Précepteur existant
 * (/precepteur/cours → conformCourseSync → FormationStage) : zéro nouveau player.
 */
const SOURCE_COURSE_KEY = 'precepteur:sourceCourse';

/** Markdown minimal (titres ## + listes + gras) — suffisant pour le manuel. */
function MiniMd({ text }) {
  const lines = String(text || '').split('\n');
  return (
    <div style={{ fontSize: 13, lineHeight: 1.55, color: 'rgba(245,241,233,.82)' }}>
      {lines.map((l, i) => {
        const t = l.trim();
        if (!t) return <div key={i} style={{ height: 6 }} />;
        if (t.startsWith('## ')) return <p key={i} style={{ fontWeight: 700, color: '#e6cc92', margin: '10px 0 4px', fontSize: 13.5 }}>{t.slice(3)}</p>;
        if (t.startsWith('* ') || t.startsWith('- ')) return <p key={i} style={{ margin: '2px 0 2px 14px' }}>• {t.slice(2)}</p>;
        return <p key={i} style={{ margin: '3px 0' }}>{t}</p>;
      })}
    </div>
  );
}

function CourseCard({ row, onPlay }) {
  const [full, setFull] = useState(null);
  const [openManual, setOpenManual] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (full) return full;
    setLoading(true);
    try { const d = await precepteurLibraryApi.get(row.id); setFull(d); return d; }
    finally { setLoading(false); }
  };

  const play = async () => {
    const d = await load();
    if (!d?.course) return;
    try { localStorage.setItem(SOURCE_COURSE_KEY, JSON.stringify(d.course)); } catch { /* noop */ }
    onPlay();
  };

  const toggleManual = async () => {
    if (!openManual) await load();
    setOpenManual((o) => !o);
  };

  const src = row.source || {};
  const nbConcepts = full?.course?.concepts?.length;

  return (
    <div style={{
      borderRadius: 18, border: '1px solid rgba(245,244,238,.10)',
      background: 'linear-gradient(180deg, rgba(217,119,87,.07), rgba(255,255,255,.02))',
      padding: 18,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ display: 'grid', placeItems: 'center', height: 40, width: 40, flexShrink: 0, borderRadius: 12, background: 'rgba(217,119,87,.16)', color: '#e58a5f' }}>
          <GraduationCap size={20} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 15.5, color: '#f5f1e9', lineHeight: 1.3 }}>{row.title || 'Cours du Précepteur'}</p>
          <p style={{ margin: '3px 0 0', fontSize: 11.5, color: 'rgba(245,241,233,.5)' }}>
            {new Date(row.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
            {nbConcepts ? ` · ${nbConcepts} concept${nbConcepts > 1 ? 's' : ''}` : ''}
            {src.url ? (
              <> · <a href={src.url} target="_blank" rel="noreferrer" style={{ color: '#e6cc92', textDecoration: 'none' }}>vidéo source <ExternalLink size={10} style={{ display: 'inline' }} /></a></>
            ) : null}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button type="button" onClick={play} disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, borderRadius: 12, border: 'none', padding: '9px 16px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', background: '#d97757', color: '#fff' }}>
          <Play size={15} /> {loading ? 'Chargement…' : 'Suivre ce cours'}
        </button>
        <button type="button" onClick={toggleManual}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, borderRadius: 12, padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'rgba(245,244,238,.08)', border: '1px solid rgba(245,244,238,.12)', color: 'rgba(245,241,233,.85)' }}>
          <BookOpen size={15} /> Manuel d'enseignement <ChevronDown size={14} style={{ transform: openManual ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }} />
        </button>
      </div>

      {openManual && (
        <div style={{ marginTop: 12, borderTop: '1px solid rgba(245,244,238,.08)', paddingTop: 12 }}>
          {full?.manual_md ? <MiniMd text={full.manual_md} /> : <p style={{ fontSize: 12.5, color: 'rgba(245,241,233,.5)' }}>{loading ? 'Chargement…' : 'Pas de manuel pour ce cours.'}</p>}
        </div>
      )}
    </div>
  );
}

export default function LiriPrecepteurLibraryPage() {
  const nav = useNavigate();
  const [rows, setRows] = useState(null); // null = chargement

  useEffect(() => {
    let alive = true;
    precepteurLibraryApi.list()
      .then((r) => { if (alive) setRows(Array.isArray(r) ? r : []); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, []);

  return (
    <LiriPortalShell active="formations">
      <div className="lp-scroll relative min-h-0 h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-5 py-8">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <span style={{ display: 'grid', placeItems: 'center', height: 44, width: 44, borderRadius: 14, background: 'rgba(230,204,146,.14)', color: '#e6cc92' }}>
              <Sparkles size={22} />
            </span>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#f5f1e9', letterSpacing: '-0.01em' }}>Bibliothèque du Précepteur</h1>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'rgba(245,241,233,.55)' }}>
                Les enseignements du fondateur, transformés en cours interactifs par l'agent.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 14, marginTop: 22 }}>
            {rows === null && <p style={{ fontSize: 13, color: 'rgba(245,241,233,.5)' }}>Chargement…</p>}
            {rows !== null && rows.length === 0 && (
              <p style={{ fontSize: 13.5, color: 'rgba(245,241,233,.6)' }}>
                Aucun cours généré pour l'instant — l'agent est en train de travailler sur les vidéos.
              </p>
            )}
            {(rows || []).map((r) => (
              <CourseCard key={r.id} row={r} onPlay={() => nav('/precepteur/cours')} />
            ))}
          </div>
        </div>
      </div>
    </LiriPortalShell>
  );
}
