import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Fil d'un SUJET du forum unifié (conversations kind='topic').
 * Contrairement à ForumThreadPage (qui lit l'ancienne table formation_student_questions),
 * cette page lit les `messages` du Sujet via la RPC get_topic_thread (les messages sont
 * en lecture service_role). Elle affiche, pour un live, TOUT ce qui le concerne :
 * récap, questions NeuronQ, questions, chat, replay — chacun catégorisé.
 * Directive artistique LIRI : fond du shell (#262624), accents coral, épuré façon Brain.
 */

const COL = {
  coral: '#d97757',
  cream: '#f5f1e9',
  t2: 'rgba(245,241,233,0.72)',
  t3: 'rgba(245,241,233,0.5)',
  card: 'rgba(255,247,240,0.022)',
  cardBorder: 'rgba(245,241,233,0.09)',
  mono: "'JetBrains Mono','Fira Code',monospace",
};

const fmtRelative = (value) => {
  if (!value) return '';
  const d = new Date(value);
  const now = new Date();
  const mins = Math.floor((now - d) / 60000);
  const hours = Math.floor((now - d) / 3600000);
  const days = Math.floor((now - d) / 86400000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  if (hours < 24) return `Il y a ${hours}h`;
  if (days === 1) return 'Hier';
  if (days < 7) return `Il y a ${days} jours`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Catégorie d'un message selon son `subject` (posé par consolidate_live_to_forum).
function classify(subject) {
  const s = subject || '';
  if (s.startsWith('🗂')) return { key: 'plan', label: 'Carte mentale', accent: '#d97757', icon: '🗂️' };
  if (s.startsWith('📝')) return { key: 'recap', label: 'Récap', accent: '#d97757', icon: '📝' };
  if (s.startsWith('▶')) return { key: 'replay', label: 'Replay', accent: '#e0926a', icon: '▶️' };
  if (s.startsWith('❓')) return { key: 'question', label: s.includes('NeuronQ') ? 'NeuronQ' : 'Question', accent: '#cc8068', icon: '❓' };
  if (s.startsWith('🧾')) return { key: 'transcript', label: 'Transcript', accent: '#bb5e3e', icon: '🧾' };
  return { key: 'chat', label: 'Discussion', accent: 'rgba(245,241,233,0.42)', icon: '💬' };
}

const urlOf = (c) => {
  const m = String(c || '').match(/https?:\/\/\S+/);
  return m ? m[0] : null;
};

export default function TopicThreadPage() {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // base du forum : `${forumBasePath}` (avant /topic/…)
  const forumBase = location.pathname.split('/topic/')[0] || '';
  const meta = location.state?.topic || null;

  const [msgs, setMsgs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!topicId) return;
    setLoading(true);
    try {
      const { data } = await supabase.rpc('get_topic_thread', { p_topic_id: topicId });
      setMsgs(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [topicId]);

  useEffect(() => { void load(); }, [load]);

  const title = meta?.question || meta?._contextTitle || 'Sujet';
  const kind = meta?._context || null;
  const kindLabel = kind === 'live' ? 'Live' : (kind === 'course' || kind === 'video') ? 'Cours' : (kind === 'class' ? 'Classe' : 'Discussion');

  // Regroupe le fil par catégorie (récap → questions → discussion → replay).
  const ordered = useMemo(() => {
    const rank = { plan: 0, recap: 0, question: 1, transcript: 2, chat: 3, replay: 4 };
    return [...msgs].sort((a, b) => {
      const ra = rank[classify(a.subject).key] ?? 3;
      const rb = rank[classify(b.subject).key] ?? 3;
      if (ra !== rb) return ra - rb;
      return new Date(a.created_at) - new Date(b.created_at);
    });
  }, [msgs]);

  // Source du Sujet (live + quelle session) → lien vers la Salle de révision
  // (le lecteur canonique), plutôt qu'un player vidéo inline concurrent.
  const topicContext = useMemo(() => ({
    type: msgs[0]?.context_type || meta?._context || null,
    id: msgs[0]?.context_id || meta?.context_id || null,
  }), [msgs, meta]);
  const salleLink = topicContext.type === 'live' && topicContext.id
    ? `${forumBase}/replay/${topicContext.id}`
    : null;

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '4px 0 40px' }}>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22, paddingTop: 4 }}>
        <button
          onClick={() => navigate(forumBase || '..')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
            padding: '7px 13px', borderRadius: 9, cursor: 'pointer',
            background: 'rgba(217,119,87,0.10)', border: '1px solid rgba(217,119,87,0.28)',
            color: COL.coral, fontSize: 12.5, fontWeight: 600,
          }}
        >← Forum</button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: COL.mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: COL.coral, textTransform: 'uppercase', marginBottom: 3 }}>
            {kindLabel}
          </div>
          <h1 style={{ fontSize: 21, fontWeight: 700, color: COL.cream, lineHeight: 1.25, letterSpacing: '-0.02em', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </h1>
        </div>
        <span style={{ flexShrink: 0, fontFamily: COL.mono, fontSize: 11, color: COL.t3, background: COL.card, border: `1px solid ${COL.cardBorder}`, borderRadius: 20, padding: '3px 11px' }}>
          {msgs.length} message{msgs.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', fontFamily: COL.mono, fontSize: 10, letterSpacing: '0.12em', color: COL.t3 }}>
          CHARGEMENT…
        </div>
      ) : ordered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '44px 20px', color: COL.t3, background: COL.card, border: `1px solid ${COL.cardBorder}`, borderRadius: 14 }}>
          <p style={{ color: COL.t2, fontSize: 14, margin: '0 0 4px' }}>Ce sujet n'a pas encore de contenu.</p>
          <p style={{ fontSize: 12.5, margin: 0 }}>Le récap, les questions et le replay du live apparaîtront ici.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ordered.map((m) => {
            const cat = classify(m.subject);
            const link = cat.key === 'replay' ? urlOf(m.content) : null;
            return (
              <article
                key={m.message_id}
                style={{
                  background: COL.card, border: `1px solid ${COL.cardBorder}`,
                  borderRadius: 13, padding: '14px 16px',
                }}
              >
                {/* Ligne méta : catégorie + auteur + date */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: COL.mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', color: cat.accent, background: 'rgba(217,119,87,0.08)', border: `1px solid rgba(217,119,87,0.20)`, borderRadius: 6, padding: '2px 8px' }}>
                    <span aria-hidden>{cat.icon}</span>{cat.label}
                  </span>
                  <span style={{ fontSize: 12, color: COL.t2, fontWeight: 500 }}>{m.sender_name || 'Membre'}</span>
                  <span aria-hidden style={{ color: COL.t3 }}>·</span>
                  <span style={{ fontFamily: COL.mono, fontSize: 11, color: COL.t3 }}>{fmtRelative(m.created_at)}</span>
                </div>

                {/* Contenu — REPLAY : pas de lecteur inline concurrent. On renvoie
                    vers la Salle de révision (lecteur canonique : vidéo + chapitres
                    + transcription + carte mentale). Repli sur le fichier brut si
                    on ne connaît pas la session (vieux Sujets). */}
                {cat.key === 'replay' ? (
                  <div>
                    <p style={{ fontSize: 13.5, color: COL.t2, lineHeight: 1.55, margin: '0 0 10px' }}>
                      Le replay est disponible dans la salle de révision — vidéo, chapitres, transcription et carte mentale au même endroit.
                    </p>
                    {salleLink ? (
                      <button
                        onClick={() => navigate(salleLink)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, cursor: 'pointer', background: COL.coral, border: 'none', color: '#1c1a17', fontSize: 13, fontWeight: 700 }}
                      >
                        ▶️ Revoir dans la salle de révision
                      </button>
                    ) : link ? (
                      <a href={link} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: COL.coral, textDecoration: 'none', fontWeight: 600 }}>
                        ▶️ Ouvrir le fichier replay
                      </a>
                    ) : null}
                  </div>
                ) : (
                  <p style={{ fontSize: 14, color: cat.key === 'chat' ? COL.t2 : COL.cream, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                    {m.content}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
