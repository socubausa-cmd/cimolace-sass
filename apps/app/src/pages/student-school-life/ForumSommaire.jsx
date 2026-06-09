import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * ForumSommaire — panneau "messagerie" : sommaire de toutes les conversations
 * du forum, comme raccourci de navigation, avec recherche intelligente
 * (insensible aux accents, FR/arabe/translittération, synonymes).
 */

// Aperçu de conversation pour affichage OPTIMISTE instantané (partagé avec ForumThreadPage).
let _forumPreview = null;
export const setForumPreview = (p) => { _forumPreview = p; };
export const takeForumPreview = (id) => (_forumPreview && String(_forumPreview.id) === String(id) ? _forumPreview : null);

const G = '#D4AF37';
const MONO = "'JetBrains Mono','Fira Code',monospace";

const norm = (s) =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// Dictionnaire de synonymes — recherche "intelligente" légère (sans IA).
const SYN = {
  wudu: ['ablutions', 'ablution'], ablutions: ['wudu'], ablution: ['wudu'],
  salat: ['priere', 'prier', 'salah'], priere: ['salat', 'salah'], prier: ['salat'],
  sawm: ['jeune', 'siyam'], jeune: ['sawm', 'siyam'],
  zakat: ['aumone'], aumone: ['zakat'],
  tawhid: ['unicite'], unicite: ['tawhid'],
  fiqh: ['jurisprudence'], aqida: ['croyance', 'dogme'],
  tajwid: ['recitation', 'prononciation'], prononciation: ['tajwid'],
  daad: ['ض'], dhaa: ['ظ'], coran: ['quran'], quran: ['coran'],
};

const expandTerms = (q) => {
  const base = norm(q);
  if (!base) return [];
  const extra = (SYN[base] || []).map(norm);
  return [base, ...extra].filter(Boolean);
};

const fmtRel = (iso) => {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'à l\'instant';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} h`;
  const j = Math.floor(h / 24);
  if (j < 7) return `${j} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

export default function ForumSommaire({ currentId, basePath = '/student-school-life/forum' }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [forms, setForms] = useState({});
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all'); // all | unanswered | resolved
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('formation_student_questions')
        .select('id,question,formation_id,reply_count,status,created_at,author_name')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(100);
      if (!alive) return;
      const qs = Array.isArray(data) ? data : [];
      setRows(qs);
      const ids = [...new Set(qs.map((r) => r.formation_id).filter(Boolean))];
      if (ids.length) {
        const { data: fs } = await supabase.from('courses').select('id,title').in('id', ids);
        if (alive) {
          const m = {};
          (fs || []).forEach((f) => { m[f.id] = f.title; });
          setForms(m);
        }
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const list = useMemo(() => {
    let r = rows;
    if (filter === 'unanswered') r = r.filter((x) => !x.reply_count);
    else if (filter === 'resolved') r = r.filter((x) => x.status === 'resolved');
    const terms = expandTerms(q);
    if (terms.length) {
      r = r.filter((x) => {
        const hay = norm(x.question) + ' ' + norm(forms[x.formation_id] || '') + ' ' + norm(x.author_name || '');
        return terms.some((t) => hay.includes(t));
      });
    }
    return r;
  }, [rows, q, filter, forms]);

  const chip = (v, label) => (
    <button
      key={v}
      type="button"
      onClick={() => setFilter(v)}
      style={{
        fontFamily: MONO, fontSize: 9, fontWeight: 600, padding: '5px 9px', borderRadius: 14,
        cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 150ms ease',
        border: '1px solid ' + (filter === v ? 'transparent' : 'rgba(255,255,255,0.08)'),
        background: filter === v ? G : 'transparent',
        color: filter === v ? '#0b0b0f' : 'rgba(245,245,247,0.5)',
      }}
    >
      {label}
    </button>
  );

  return (
    <aside style={{ width: 260, flexShrink: 0 }}>
      <div style={{ background: 'rgba(15,15,20,0.28)', border: '1px solid rgba(255,255,255,0.045)', borderRadius: 16, overflow: 'hidden', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', display: 'flex', flexDirection: 'column' }}>
        {/* Header + recherche */}
        <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#F5F5F7', letterSpacing: '-0.01em' }}>Conversations</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: G, background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.28)', borderRadius: 20, padding: '2px 8px' }}>{list.length}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(11,11,15,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, padding: '7px 10px' }}>
            <svg viewBox="0 0 20 20" width="13" height="13" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="9" cy="9" r="5.5" stroke="rgba(245,245,247,0.4)" strokeWidth="1.5" />
              <line x1="13.5" y1="13.5" x2="17" y2="17" stroke="rgba(245,245,247,0.4)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un mot, un concept…"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 12, color: '#F5F5F7', minWidth: 0 }}
            />
            {q && (
              <button type="button" onClick={() => setQ('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(245,245,247,0.4)', fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 5, marginTop: 10 }}>
            {chip('all', 'Toutes')}
            {chip('unanswered', 'Sans réponse')}
            {chip('resolved', 'Résolues')}
          </div>
        </div>

        {/* Liste — ~5 sujets visibles, le reste défile à l'intérieur */}
        <div style={{ maxHeight: 440, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 11, color: 'rgba(245,245,247,0.4)' }}>Chargement…</div>
          ) : list.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 11, color: 'rgba(245,245,247,0.4)', lineHeight: 1.6 }}>
              {q ? <>Aucune conversation pour<br />« {q} »</> : 'Aucune conversation'}
            </div>
          ) : (
            list.map((x) => {
              const active = String(x.id) === String(currentId);
              return (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => { setForumPreview({ id: x.id, question: x.question, formation_id: x.formation_id, author_name: x.author_name, status: x.status, reply_count: x.reply_count, created_at: x.created_at }); navigate(`${basePath}/thread/${x.id}`); }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px',
                    border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer',
                    background: active ? 'rgba(212,175,55,0.08)' : 'transparent',
                    borderLeft: active ? `2px solid ${G}` : '2px solid transparent',
                    transition: 'background 150ms ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontFamily: MONO, fontSize: 8.5, color: G, textTransform: 'uppercase', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {forms[x.formation_id] || 'Forum général'}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(245,245,247,0.35)', flexShrink: 0 }}>{fmtRel(x.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: active ? '#F5F5F7' : 'rgba(245,245,247,0.78)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {x.question}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(245,245,247,0.4)' }}>{x.reply_count || 0} rép.</span>
                    {x.status === 'resolved' && (
                      <span style={{ fontFamily: MONO, fontSize: 8.5, color: '#22C55E', background: 'rgba(34,197,94,0.12)', borderRadius: 10, padding: '1px 6px' }}>✓ résolu</span>
                    )}
                    {!x.reply_count && (
                      <span style={{ fontFamily: MONO, fontSize: 8.5, color: '#F59E0B', background: 'rgba(245,158,11,0.12)', borderRadius: 10, padding: '1px 6px' }}>sans réponse</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
