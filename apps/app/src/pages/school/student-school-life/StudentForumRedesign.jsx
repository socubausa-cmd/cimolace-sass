/**
 * StudentForumRedesign — Charte LIRI Prorascience
 * Source design : /Downloads/interface studio/Prorascience Dashboard & Forum.html
 * Charte chaude LIRI (host-aware) · Coral #d97757 · terracotta · ambre (ex-or/navy/violet bannis)
 */
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { getApiBaseUrl } from '@/lib/apiBase';
import { authStore } from '@/lib/auth-store';
import { useForumFavorites, useForumVotes } from '@/hooks/useForumNotifications';
// Thème host-aware : `T` = tokens vivants (clair sous l'espace élève, sombre sous le portail prof).
import { themeProxy as T, useSslThemeMode, useSslTheme } from '@/pages/school/student-school-life/sslTheme';

/* ─── Helpers ─── */
const fmtSecs = (s) => {
  if (!Number.isFinite(Number(s))) return null;
  const n = Math.round(Number(s));
  const m = Math.floor(n / 60);
  const sec = n % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
};

const fmtRelative = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "À l'instant";
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays} jours`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Sujets connectés (conversations kind='topic') : libellé lisible du contexte de la ressource.
// Sert d'« auteur » de la carte (le Sujet n'a pas d'auteur unique comme une question d'élève).
const TOPIC_CONTEXT_LABEL = {
  live: 'Discussion live',
  video: 'Discussion vidéo',
  class: 'Discussion de classe',
  course: 'Discussion du cours',
};
const topicContextLabel = (ctx) => TOPIC_CONTEXT_LABEL[ctx] || 'Sujet';

// Palette LIRI : nuances CORAL/terracotta (différencient les formations, tout chaud). Directive artistique.
const ACCENT_COLORS = ['#d97757', '#e0926a', '#c96846', '#e8a585', '#bb5e3e', '#f0b89a'];

/* ─── SVG Icons ─── */
const IcMsg = ({ size = 14, col }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} fill="none" style={{ flexShrink: 0 }}>
    <path d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H7l-4 3V5z"
      fill="none" stroke={col || 'currentColor'} strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
);
const IcPlay = ({ size = 14, col }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} fill="none" style={{ flexShrink: 0 }}>
    <circle cx="10" cy="10" r="7" fill="none" stroke={col || 'currentColor'} strokeWidth="1.5"/>
    <path d="M8 7.5l5 2.5-5 2.5V7.5z" fill={col || 'currentColor'}/>
  </svg>
);
const IcSearch = ({ size = 13, col }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} fill="none" style={{ flexShrink: 0 }}>
    <circle cx="9" cy="9" r="5.5" fill="none" stroke={col || 'currentColor'} strokeWidth="1.5"/>
    <line x1="13.5" y1="13.5" x2="17" y2="17" stroke={col || 'currentColor'} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IcPlus = ({ size = 13, col }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} fill="none" style={{ flexShrink: 0 }}>
    <line x1="10" y1="3" x2="10" y2="17" stroke={col || 'currentColor'} strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="3" y1="10" x2="17" y2="10" stroke={col || 'currentColor'} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IcChevR = ({ size = 14, col }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} fill="none" style={{ flexShrink: 0 }}>
    <polyline points="7,5 13,10 7,15" fill="none" stroke={col || 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IcX = ({ size = 13, col }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} fill="none" style={{ flexShrink: 0 }}>
    <line x1="5" y1="5" x2="15" y2="15" stroke={col || 'currentColor'} strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="15" y1="5" x2="5" y2="15" stroke={col || 'currentColor'} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IcLoader = ({ size = 16, col }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} fill="none" style={{ flexShrink: 0, animation: 'forumSpin 1s linear infinite' }}>
    <circle cx="10" cy="10" r="7" stroke={col || T.t4} strokeWidth="1.5"/>
    <path d="M10 3a7 7 0 017 7" stroke={col || T.gold} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const IcSpark = ({ size = 13, col }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} fill="none" style={{ flexShrink: 0 }}>
    <path d="M10 2.4l1.7 5.4 5.4 1.7-5.4 1.7L10 16.6 8.3 11.2 2.9 9.5l5.4-1.7z" fill={col || 'currentColor'}/>
  </svg>
);
const IcLifebuoy = ({ size = 13, col }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} fill="none" style={{ flexShrink: 0 }}>
    <circle cx="10" cy="10" r="7.2" stroke={col || 'currentColor'} strokeWidth="1.5"/>
    <circle cx="10" cy="10" r="3" stroke={col || 'currentColor'} strokeWidth="1.5"/>
    <path d="M10 2.8v4.2M10 13v4.2M2.8 10H7M13 10h4.2" stroke={col || 'currentColor'} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IcLayers = ({ size = 13, col }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} fill="none" style={{ flexShrink: 0 }}>
    <path d="M10 3l7 3.5-7 3.5-7-3.5L10 3z" stroke={col || 'currentColor'} strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M3 11l7 3.5 7-3.5" stroke={col || 'currentColor'} strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
);

/* ─── ForumPostCard ─── */
const ForumPostCard = ({ post, answerCount, formationTitle, formationAccent, onOpenThread, delay = 0, reason }) => {
  const [hov, setHov] = useState(false);
  const startN = Number(post.clip_start_seconds);
  const endN = Number(post.clip_end_seconds);
  // Vrai clip uniquement si la fenêtre a une durée (fin > début).
  const hasClip = Number.isFinite(startN) && Number.isFinite(endN) && endN > startN;

  return (
    <article
      onClick={() => { if (onOpenThread) onOpenThread(post); }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        // Item MINIMAL cliquable (façon liste du Brain) : question + 1 ligne de méta. Tout le reste
        // (badges empilés, avatar, boutons, clip inline) déplacé dans la page du sujet → anti-surcharge.
        background: hov ? 'rgba(217,119,87,0.06)' : 'rgba(255,247,240,0.018)',
        border: `1px solid ${hov ? 'rgba(217,119,87,0.22)' : 'rgba(245,241,233,0.08)'}`,
        borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
        transition: 'background 200ms ease, border-color 200ms ease',
        animation: `forumFadeUp 0.4s ease ${delay}ms both`,
      }}
    >
      {/* Question (titre) */}
      <p style={{ fontSize: 15, fontWeight: 500, color: T.t1, lineHeight: 1.5, marginBottom: 7, letterSpacing: '-0.005em' }}>
        {post.question}
      </p>
      {/* Méta — une seule ligne discrète */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', fontSize: 11.5, color: T.t3 }}>
        <span style={{ color: T.t2 }}>{post.author_name || 'Élève'}</span>
        <span aria-hidden>·</span>
        <span style={{ fontFamily: T.mono }}>{fmtRelative(post.created_at)}</span>
        <span aria-hidden>·</span>
        <span>{answerCount} réponse{answerCount !== 1 ? 's' : ''}</span>
        {hasClip && (
          <>
            <span aria-hidden>·</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: T.gold }}><IcPlay size={11} col={T.gold}/>clip</span>
          </>
        )}
        {reason && (
          <span style={{ marginLeft: 'auto', fontFamily: T.mono, fontSize: 9.5, fontWeight: 700, color: reason.col, background: reason.bg, border: `1px solid ${reason.bd}`, borderRadius: 6, padding: '1px 7px' }}>
            {reason.label}
          </span>
        )}
      </div>
    </article>
  );
};

/* Sub-components for buttons to avoid inline hook usage */
const OpenButton = ({ expanded, onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: expanded ? T.gold : hov ? T.surface2 : T.surface,
        border: `1px solid ${expanded ? 'transparent' : hov ? T.goldMid : T.borderMid}`,
        borderRadius: 8, padding: '6px 14px',
        fontWeight: 600, fontSize: 12,
        color: expanded ? '#000' : hov ? T.gold : T.t1,
        transition: 'all 150ms ease', cursor: 'pointer',
      }}
    >
      <IcMsg size={13} col={expanded ? '#000' : hov ? T.gold : 'currentColor'}/>
      Ouvrir le sujet
    </button>
  );
};

const ClipButton = ({ active, onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: T.surface,
        border: `1px solid ${hov ? 'rgba(217,119,87,0.3)' : T.border}`,
        borderRadius: 8, padding: '6px 14px',
        fontWeight: 500, fontSize: 12,
        color: active ? T.cyan : hov ? T.cyan : T.t2,
        transition: 'all 150ms ease', cursor: 'pointer',
      }}
    >
      <IcPlay size={13} col={active ? T.cyan : hov ? T.cyan : 'currentColor'}/>
      {active ? 'Fermer le clip' : 'Lire le clip'}
    </button>
  );
};

/* ─── Sidebar GAUCHE : CTA + recherche + filtres + formations (organisation façon LIRI Brain) ─── */
const ForumSidebar = ({ formations, onNewQuestion, onSearch, searchVal, feed, onFeedChange, counts }) => {
  const [focused, setFocused] = useState(false);

  return (
    <aside style={{
      width: 250, flexShrink: 0,
      display: 'flex', flexDirection: 'column', gap: 16,
      paddingTop: 0,
    }}>
      {/* CTA en tête (équivalent « Nouvelle conversation » du Brain) */}
      <NewQuestionBtn onClick={onNewQuestion}/>

      {/* Recherche */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: T.surface,
        border: `1px solid ${focused ? T.goldMid : T.border}`,
        borderRadius: 9, padding: '8px 11px',
        transition: 'border-color 150ms ease',
      }}>
        <IcSearch size={13} col={T.t3}/>
        <input
          value={searchVal}
          onChange={(e) => onSearch(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Rechercher un sujet…"
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 12, color: T.t1, fontFamily: 'inherit' }}
        />
        {searchVal && (
          <button onClick={() => onSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
            <IcX size={11} col={T.t3}/>
          </button>
        )}
      </div>

      {/* Filtres (segments) en liste verticale — ex-chips du corps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {FEEDS.map((f) => {
          const active = feed === f.key;
          const Icon = f.Icon;
          const count = counts?.[f.key];
          return (
            <button
              key={f.key}
              onClick={() => onFeedChange(f.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                background: active ? '#cc8068' : 'rgba(217,119,87,0.08)',
                border: `1px solid ${active ? 'transparent' : 'rgba(217,119,87,0.20)'}`,
                borderRadius: 9, padding: '9px 12px', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                color: active ? '#2a1c14' : T.gold,
                transition: 'all 150ms ease', textAlign: 'left',
              }}
            >
              <Icon size={14} col={active ? '#2a1c14' : T.gold}/>
              <span style={{ flex: 1 }}>{f.label}</span>
              {count != null && count > 0 && (
                <span style={{
                  fontFamily: T.mono, fontSize: 10, fontWeight: 700,
                  color: active ? '#2a1c14' : T.gold,
                  background: active ? 'rgba(0,0,0,0.12)' : T.goldDim,
                  borderRadius: 6, padding: '0 6px', minWidth: 18, textAlign: 'center',
                }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Formations actives */}
      {formations.length > 0 && (
        <div style={{
          background: T.surface2, border: `1px solid ${T.border}`,
          borderRadius: 12, overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px 10px',
            borderBottom: `1px solid ${T.border}`,
            fontFamily: T.mono, fontSize: 9, fontWeight: 700,
            color: T.t3, letterSpacing: '0.12em',
          }}>
            FORMATIONS ACTIVES
          </div>
          {formations.map((f, i) => {
            const accent = ACCENT_COLORS[i % ACCENT_COLORS.length];
            return (
              <FormationRow key={f.id} formation={f} accent={accent}/>
            );
          })}
        </div>
      )}
    </aside>
  );
};

const NewQuestionBtn = ({ onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        background: '#cc8068', border: 'none', borderRadius: 9,
        padding: '9px 14px', fontWeight: 700, fontSize: 12,
        color: '#2a1c14', cursor: 'pointer',
        opacity: hov ? 0.85 : 1,
        transform: hov ? 'translateY(-1px)' : 'none',
        transition: 'all 150ms ease',
        letterSpacing: '0.01em',
      }}
    >
      <IcPlus size={13} col="#2a1c14"/>
      Poser une question
    </button>
  );
};

const FormationRow = ({ formation, accent }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 14px', borderBottom: `1px solid ${T.border}`,
        cursor: 'pointer',
        background: hov ? T.surface : 'transparent',
        transition: 'background 150ms ease',
      }}
    >
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: accent, flexShrink: 0,
      }}/>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{
          fontSize: 11, fontWeight: 500, color: T.t1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {formation.title}
        </div>
        {formation.progress != null && (
          <div style={{ height: 2, background: T.border, borderRadius: 1, marginTop: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${formation.progress}%`, background: accent, borderRadius: 1 }}/>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Empty state ─── */
const EmptyForum = ({ search, onReset }) => (
  <div style={{
    textAlign: 'center', padding: '48px 24px',
    color: T.t3, fontSize: 13,
    background: T.surface, border: `1px solid ${T.border}`,
    borderRadius: 14,
  }}>
    <div style={{ fontSize: 28, marginBottom: 12 }}>◷</div>
    {search
      ? <>Aucun sujet pour « {search} »<br/><button onClick={onReset} style={{ marginTop: 10, color: T.gold, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: T.mono }}>Effacer la recherche</button></>
      : 'Aucune question publiée pour le moment.'}
  </div>
);

/* ─── Empty state · Tu peux aider ─── */
const EmptyHelp = () => (
  <div style={{
    textAlign: 'center', padding: '48px 24px', color: T.t3, fontSize: 13,
    background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14,
  }}>
    <div style={{ display: 'inline-flex', marginBottom: 12 }}>
      <svg viewBox="0 0 24 24" width={30} height={30} fill="none">
        <circle cx="12" cy="12" r="10" stroke={T.success} strokeWidth="1.5"/>
        <path d="M8 12.4l2.6 2.6L16 9" stroke={T.success} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
    <div style={{ color: T.t2, fontWeight: 500, marginBottom: 4 }}>Tout est à jour</div>
    Aucune question en attente dans tes formations.<br/>Reviens plus tard pour aider la communauté.
  </div>
);

/* ─── Feed adaptatif : segments ─── */
const FEEDS = [
  { key: 'pour-toi', label: 'Pour toi', Icon: IcSpark },
  { key: 'aider',    label: 'Tu peux aider', Icon: IcLifebuoy },
  { key: 'tous',     label: 'Tous les sujets', Icon: IcLayers },
];
const SUBTITLES = {
  'pour-toi': 'Sélection personnalisée selon tes formations et l’activité récente.',
  'aider':    'Questions sans réponse où ton aide ferait la différence.',
  'tous':     'Questions publiques entre élèves · réponses et extraits vidéo liés.',
};

const FeedTab = ({ active, label, count, Icon, onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        background: active ? '#cc8068' : 'rgba(217,119,87,0.10)',
        border: `1px solid ${active ? 'transparent' : 'rgba(217,119,87,0.28)'}`,
        borderRadius: 11, padding: '7px 14px',
        fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
        color: active ? '#2a1c14' : T.gold,
        cursor: 'pointer', transition: 'all 160ms ease', whiteSpace: 'nowrap',
      }}
    >
      <Icon size={13} col={active ? '#2a1c14' : T.gold}/>
      {label}
      {count != null && count > 0 && (
        <span style={{
          fontFamily: T.mono, fontSize: 10, fontWeight: 700,
          color: active ? '#2a1c14' : T.gold,
          background: active ? 'rgba(0,0,0,0.12)' : T.goldDim,
          borderRadius: 6, padding: '0 6px', minWidth: 17, textAlign: 'center',
        }}>{count}</span>
      )}
    </button>
  );
};

const FeedTabs = ({ value, onChange, counts }) => (
  <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', animation: 'forumFadeUp 0.5s ease both' }}>
    {FEEDS.map((f) => (
      <FeedTab
        key={f.key}
        active={value === f.key}
        label={f.label}
        Icon={f.Icon}
        count={counts[f.key]}
        onClick={() => onChange(f.key)}
      />
    ))}
  </div>
);

/* ─── Fond immersif — 3 ambiances testables (host-aware clair/sombre) ─── */
function ForumBg({ variant }) {
  const { isLight } = useSslTheme();
  // SOMBRE (portail) = étalon « Formation Builder » : fond #262624 + grille discrète, SANS halos (simple).
  if (!isLight) {
    return (
      <div aria-hidden className="forum-bg" style={{
        position: 'absolute', inset: 0,
        background: '#262624',
        backgroundImage: 'linear-gradient(rgba(245,244,238,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(245,244,238,0.022) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }}/>
    );
  }
  // CLAIR (espace élève) : aurore douce d'origine.
  const base = 'linear-gradient(180deg, #F7F8FA 0%, #F4F5F7 58%, #EFF0F3 100%)';
  const vignette = 'radial-gradient(135% 100% at 50% 22%, transparent 60%, rgba(0,0,0,0.05) 100%)';
  const goldBlob   = 'rgba(217,119,87,0.13)';
  const navyBlob   = 'rgba(198,111,83,0.10)';
  const goldBlob2  = 'rgba(217,119,87,0.07)';
  if (variant === 'aurore') {
    return (
      <div aria-hidden className="forum-bg" style={{ position: 'absolute', inset: 0, background: base }}>
        <div style={{ position:'absolute', width:'70vw', height:'70vw', top:'-24%', right:'-14%', borderRadius:'50%', background:`radial-gradient(circle, ${goldBlob}, transparent 60%)`, filter:'blur(34px)', animation:'forumAurora1 26s ease-in-out infinite' }}/>
        <div style={{ position:'absolute', width:'64vw', height:'64vw', bottom:'-28%', left:'-18%', borderRadius:'50%', background:`radial-gradient(circle, ${navyBlob}, transparent 60%)`, filter:'blur(34px)', animation:'forumAurora2 33s ease-in-out infinite' }}/>
        <div style={{ position:'absolute', width:'48vw', height:'48vw', top:'34%', left:'44%', borderRadius:'50%', background:`radial-gradient(circle, ${goldBlob2}, transparent 60%)`, filter:'blur(42px)', animation:'forumAurora3 23s ease-in-out infinite' }}/>
        <div style={{ position:'absolute', inset:0, background: vignette }}/>
      </div>
    );
  }
  if (variant === 'zellige') {
    const pattern = `url("data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><g fill='none' stroke='#d97757' stroke-width='1'><path d='M30 2 L37 23 L58 30 L37 37 L30 58 L23 37 L2 30 L23 23 Z'/><circle cx='30' cy='30' r='8'/></g></svg>")}")`;
    return (
      <div aria-hidden className="forum-bg" style={{ position: 'absolute', inset: 0, background: base }}>
        <div style={{ position:'absolute', inset:0, opacity: isLight ? 0.05 : 0.07, backgroundImage: pattern, backgroundSize:'54px 54px' }}/>
        <div style={{ position:'absolute', inset:0, background:`radial-gradient(820px 620px at 50% 26%, ${goldBlob}, transparent 60%)` }}/>
        <div style={{ position:'absolute', inset:0, background: vignette }}/>
      </div>
    );
  }
  // halos (défaut)
  return (
    <div aria-hidden className="forum-bg" style={{ position: 'absolute', inset: 0, background: `radial-gradient(1000px 720px at 88% -10%, ${goldBlob}, transparent 55%), radial-gradient(940px 820px at 4% 114%, ${navyBlob}, transparent 55%), ${base}` }}>
      <div style={{ position:'absolute', inset:0, background: vignette }}/>
    </div>
  );
}

/* ══════════════════════════ MAIN EXPORT ═══════════════════════════════════ */
/* ─── Groupes de SOURCE — le forum est organisé par origine de la conversation ───
   Un live regroupe tout ce qui le concerne (récap/recall, discussions, replay,
   mindmap, NeuronQ) ; un cours regroupe sa post-production ; le reste = questions
   communautaires. L'ordre ci-dessous = l'ordre d'affichage des sections. */
const SOURCE_GROUPS = [
  { key: 'live',     label: 'Lives',                     Icon: IcPlay,   match: (r) => r._context === 'live' },
  { key: 'course',   label: 'Cours',                     Icon: IcLayers, match: (r) => ['course', 'video', 'class'].includes(r._context) },
  { key: 'question', label: 'Questions de la communauté', Icon: IcMsg,    match: (r) => !['live', 'course', 'video', 'class'].includes(r._context) },
];

/* En-tête de section discret (icône + label + compteur + filet), façon LIRI Brain. */
const SourceSectionHeader = ({ Icon, label, count }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
    <Icon size={14} col={T.gold} />
    <h2 style={{ fontSize: 13, fontWeight: 700, color: T.t1, letterSpacing: '0.01em', margin: 0 }}>{label}</h2>
    <span style={{ fontFamily: T.mono, fontSize: 10, color: T.t3, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, padding: '1px 8px' }}>{count}</span>
    <div style={{ flex: 1, height: 1, background: T.border, marginLeft: 4 }} />
  </div>
);

export default function StudentForumRedesign({ forumBasePath = '/student-school-life/forum' }) {
  useSslThemeMode(); // publie le mode (clair/sombre) pour `T` AVANT le rendu des sous-composants
  const navigate = useNavigate();

  // Data
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [answersCount, setAnswersCount] = useState({});
  const [formationMap, setFormationMap] = useState({});  // id -> { title, color, progress }
  const [formationList, setFormationList] = useState([]); // for sidebar

  // Filters
  const [search, setSearch] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [feed, setFeed] = useState('pour-toi');
  const [enrolledIds, setEnrolledIds] = useState(() => new Set());

  // Auth hooks
  const { favorites, isFav } = useForumFavorites(currentUser?.id);
  const { votes } = useForumVotes(currentUser?.id);

  // Load current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user));
  }, []);

  // Mes formations (inscriptions) → personnalisation du feed
  useEffect(() => {
    if (!currentUser?.id) return;
    let alive = true;
    supabase
      .from('student_progress')
      .select('course_id')
      .eq('user_id', currentUser.id)
      .then(({ data }) => {
        if (!alive) return;
        setEnrolledIds(new Set((data || []).map((r) => r.course_id).filter(Boolean)));
      });
    return () => { alive = false; };
  }, [currentUser?.id]);

  // Load forum data
  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        // Forum UNIFIÉ : une seule source = les Sujets (conversations kind='topic'),
        // lus via la RPC get_forum_topics (SECURITY DEFINER, RLS répliqué + message_count).
        // Les anciennes questions d'élèves SONT désormais des Sujets (migration 20260630120000),
        // donc on NE lit plus formation_student_questions (évite les doublons).
        const { data: topics } = await supabase.rpc('get_forum_topics', { p_limit: 100 });
        if (!alive) return;
        const list = Array.isArray(topics) ? topics : [];
        const rows = list.map(t => {
          const ctx = t.context_type || null;
          const isSource = ctx === 'live' || ctx === 'course' || ctx === 'video' || ctx === 'class';
          return {
            id: t.id,
            // Titre : pour un live/cours, le VRAI titre de la source (live_sessions.title /
            // courses.title, renvoyé par la RPC) ; sinon le sujet de la question.
            question: (isSource && t.context_title) ? t.context_title : (t.subject || 'Sujet'),
            author_name: topicContextLabel(ctx),
            created_at: t.context_at || t.created_at,
            reply_count: Number(t.message_count) || 0,
            formation_id: t.source_formation_id || (ctx === 'course' ? t.context_id : null),
            is_pinned: false,
            vote_count: 0,
            status: 'open',
            _src: 'topic',
            _context: ctx,
            _contextStatus: t.context_status || null,
          };
        });
        setRows(rows);
        setLoading(false);

        // answersCount = message_count par Sujet (le rendu lit answersCount[id] || reply_count).
        const grouped = {};
        rows.forEach(r => { grouped[r.id] = r.reply_count; });
        setAnswersCount(grouped);

        // Formations actives (sidebar) : dérivées des Sujets rattachés à un cours.
        const formationIds = [...new Set(rows.map(r => r.formation_id).filter(Boolean))];
        if (formationIds.length > 0) {
          const { data: formations } = await supabase
            .from('courses')
            .select('id,title')
            .in('id', formationIds);

          if (!alive) return;
          const map = {};
          (formations || []).forEach((f, i) => {
            map[f.id] = { title: f.title || 'Formation', color: ACCENT_COLORS[i % ACCENT_COLORS.length] };
          });
          setFormationMap(map);
          setFormationList((formations || []).map((f) => ({
            id: f.id,
            title: f.title || 'Formation',
            progress: null,
          })));
        }
      } finally {
        if (alive) setLoading(false);
      }
    };

    void load();

    // Realtime
    const channel = supabase
      .channel('forum-liri')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations', filter: 'kind=eq.topic' },
        () => { void load(); })
      .subscribe();

    return () => { alive = false; supabase.removeChannel(channel); };
  }, []);

  // ── Feed adaptatif ──────────────────────────────────────────────
  const myId = currentUser?.id;

  const matchSearch = useCallback((row) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      String(row.question || '').toLowerCase().includes(q) ||
      String(formationMap[row.formation_id]?.title || '').toLowerCase().includes(q)
    );
  }, [search, formationMap]);

  const ansCountOf = useCallback((r) => (answersCount[r.id] ?? r.reply_count ?? 0), [answersCount]);
  const isUnresolved = useCallback((r) => !r.accepted_answer_id && r.status !== 'resolved', []);

  // « Pour toi » — score de pertinence (formation suivie, fraîcheur, votes, sans réponse).
  const pourToiAll = useMemo(() => {
    const now = Date.now();
    const score = (r) => {
      let s = 0;
      if (enrolledIds.has(r.formation_id)) s += 60;
      const ageD = (now - new Date(r.created_at).getTime()) / 86400000;
      if (ageD < 1) s += 25; else if (ageD < 3) s += 14; else if (ageD < 7) s += 6;
      s += Math.min(Number(r.vote_count) || 0, 8) * 2;
      if (ansCountOf(r) === 0 && isUnresolved(r)) s += 12;
      if (!isUnresolved(r)) s += 4;
      if (r.video_storage_path || r.video_url) s += 5;
      if (r.is_pinned) s += 40;
      return s;
    };
    return rows.map((r) => [r, score(r)]).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  }, [rows, enrolledIds, ansCountOf, isUnresolved]);

  // « Tu peux aider » — questions non résolues, dans mes formations, pas les miennes,
  // les plus en attente d'abord (moins de réponses, plus anciennes).
  const aiderAll = useMemo(() => {
    const hasEnroll = enrolledIds.size > 0;
    const pool = rows.filter((r) =>
      isUnresolved(r) &&
      r.student_id !== myId &&
      (!hasEnroll || enrolledIds.has(r.formation_id))
    );
    return pool.sort((a, b) => {
      const ea = enrolledIds.has(a.formation_id) ? 1 : 0;
      const eb = enrolledIds.has(b.formation_id) ? 1 : 0;
      if (ea !== eb) return eb - ea;
      const ca = ansCountOf(a), cb = ansCountOf(b);
      if (ca !== cb) return ca - cb;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [rows, enrolledIds, myId, isUnresolved, ansCountOf]);

  const activeList = useMemo(() => {
    const base = feed === 'tous' ? rows : feed === 'aider' ? aiderAll : pourToiAll;
    return base.filter(matchSearch);
  }, [feed, rows, aiderAll, pourToiAll, matchSearch]);

  const counts = useMemo(() => ({
    'pour-toi': pourToiAll.length,
    'aider': aiderAll.length,
    'tous': rows.length,
  }), [pourToiAll, aiderAll, rows]);

  // Groupement PAR SOURCE (Lives / Cours / Questions) — préserve l'ordre du feed
  // actif à l'intérieur de chaque groupe. C'est l'organisation « par source de
  // conversation » : un live regroupe recall + discussions + replay + mindmap…
  const groupedList = useMemo(
    () => SOURCE_GROUPS
      .map((g) => ({ ...g, items: activeList.filter(g.match) }))
      .filter((g) => g.items.length > 0),
    [activeList],
  );

  const reasonFor = useCallback((r) => {
    const TONE = {
      gold:    { col: T.gold,    bg: T.goldDim,               bd: T.goldMid },
      green:   { col: T.success, bg: 'rgba(34,197,94,0.12)',  bd: 'rgba(34,197,94,0.30)' },
      amber:   { col: T.warning, bg: 'rgba(245,158,11,0.12)', bd: 'rgba(245,158,11,0.30)' },
      neutral: { col: T.t2,      bg: T.surface,               bd: T.border },
    };
    if (feed === 'aider') {
      return enrolledIds.has(r.formation_id)
        ? { label: 'Ta formation', ...TONE.gold }
        : { label: 'Sans réponse', ...TONE.neutral };
    }
    if (feed === 'pour-toi') {
      if (enrolledIds.has(r.formation_id)) return { label: 'Ta formation', ...TONE.gold };
      if ((Number(r.vote_count) || 0) >= 3) return { label: 'Populaire', ...TONE.amber };
      const ageH = (Date.now() - new Date(r.created_at).getTime()) / 3600000;
      if (ageH < 24) return { label: 'Nouveau', ...TONE.green };
      if (ansCountOf(r) === 0 && isUnresolved(r)) return { label: 'Sans réponse', ...TONE.neutral };
      return null;
    }
    return null;
  }, [feed, enrolledIds, ansCountOf, isUnresolved]);

  const handleOpenThread = (post) => {
    const id = post?.id;
    if (!id) return;
    // Forum unifié : chaque entrée est un Sujet (conversations kind='topic'). On ouvre
    // SON fil (récap, questions NeuronQ, chat, replay du live/cours) via TopicThreadPage,
    // en passant le Sujet dans le state pour un en-tête instantané (titre + type de source).
    if (post._src === 'topic') {
      navigate(`${forumBasePath}/topic/${id}`, { state: { topic: post } });
      return;
    }
    navigate(`${forumBasePath}/thread/${id}`);
  };

  return (
    <>
      <style>{`
        @keyframes forumFadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes forumFadeIn { from{opacity:0} to{opacity:1} }
        @keyframes forumSpin   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes forumAurora1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-6vw,5vh)} }
        @keyframes forumAurora2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(7vw,-4vh)} }
        @keyframes forumAurora3 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(5vw,-7vh)} }
        .forum-root aside > div { backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); }
      `}</style>

      <div style={{ position: 'relative', minHeight: 'calc(100dvh - 117px)' }}>
        {/* Fond immersif */}
        <div style={{ position: 'absolute', inset: '-28px -24px -48px -24px', zIndex: 0, overflow: 'hidden', borderRadius: 0 }}>
          <ForumBg variant="aurore" />
        </div>

        <div className="forum-root" style={{ display: 'flex', gap: 24, alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>

        {/* ── Sidebar GAUCHE : contrôles regroupés (façon LIRI Brain) ── */}
        <ForumSidebar
          formations={formationList}
          onNewQuestion={() => navigate(`${forumBasePath}/new`)}
          onSearch={setSearch}
          searchVal={search}
          feed={feed}
          onFeedChange={setFeed}
          counts={counts}
        />

        {/* ── Main posts column ── */}
        <div style={{ flex: 1, minWidth: 0, maxWidth: 880 }}>

          {/* Page header */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            marginBottom: 24, animation: 'forumFadeUp 0.5s ease both',
          }}>
            <div>
              <h1 style={{
                fontSize: 26, fontWeight: 700, color: T.t1,
                letterSpacing: '-0.025em', lineHeight: 1.2, marginBottom: 5,
              }}>Forum Communauté</h1>
              <p style={{ fontSize: 13, color: T.t3 }}>
                {SUBTITLES[feed]}
              </p>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: T.surface, border: `1px solid ${T.border}`,
              borderRadius: 8, padding: '5px 12px',
              fontFamily: T.mono, fontSize: 11, color: T.t2, flexShrink: 0,
            }}>
              <span style={{ color: T.gold }}>◎</span>
              {activeList.length} sujet{activeList.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Posts list */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: 12 }}>
              <IcLoader size={28} col={T.gold}/>
              <span style={{ fontFamily: T.mono, fontSize: 9, color: T.t3, letterSpacing: '0.12em' }}>CHARGEMENT</span>
            </div>
          ) : activeList.length === 0 ? (
            feed === 'aider'
              ? <EmptyHelp />
              : <EmptyForum search={search} onReset={() => setSearch('')}/>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
              {groupedList.map((g) => (
                <section key={g.key}>
                  <SourceSectionHeader Icon={g.Icon} label={g.label} count={g.items.length} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {g.items.map((post, i) => {
                      const formInfo = formationMap[post.formation_id];
                      return (
                        <ForumPostCard
                          key={post.id}
                          post={post}
                          answerCount={answersCount[post.id] || post.reply_count || 0}
                          formationTitle={formInfo?.title}
                          formationAccent={formInfo?.color}
                          onOpenThread={handleOpenThread}
                          reason={reasonFor(post)}
                          delay={i * 40}
                        />
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        </div>
      </div>
    </>
  );
}
