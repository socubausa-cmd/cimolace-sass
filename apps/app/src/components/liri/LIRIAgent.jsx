/**
 * Agent pédagogique LIRI — Prorascience / NGOWAZULU (SmartBoard + MasterScript).
 * Génération via Supabase Edge `liri-agent-course-generate`.
 * Thème : dark — cohérent avec LiveHostPage / Studio ISNA.
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { invokeSupabaseFunction } from '@/lib/supabaseEdgeInvoke';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  buildLiriCourseTextForLiveStudio,
  savePendingArchitectForLiveStudio,
  savePendingLiriCourseForLiveStudio,
} from '@/lib/liriAgentExportToLiveStudio';
import { saveLiriAgentCoursForKonvaDesigner } from '@/lib/liriAgentToKonvaDesigner';
import { resolveArchitectDesignCanvasForApiRequest } from '@/lib/smartboardDesignCanvas';

/** Guillemets / espaces (souvent copiés depuis Netlify) — la passerelle jose rejette sinon « Invalid Token or Protected Header formatting ». */
function normalizeSupabaseAnonKey(raw) {
  if (raw == null || raw === '') return '';
  let s = String(raw).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s.replace(/\s/g, '');
}

function isLikelyJwt(s) {
  return typeof s === 'string' && s.split('.').length === 3 && s.length > 40;
}

// ============================================================
//  MÉTADONNÉES DES 10 ÉTAPES
// ============================================================

const STEPS_META = [
  { id: 1,  court: 'Atelier',       complet: "Atelier d'ouverture",          tag: 'DÉCLENCHEUR',         type: 'ouverture'   },
  { id: 2,  court: 'Interaction',   complet: 'Interaction des élèves',        tag: 'PARTICIPATION',       type: 'ouverture'   },
  { id: 3,  court: 'Limites',       complet: 'Mise en évidence des limites',  tag: 'CONFLIT COGNITIF',    type: 'ouverture'   },
  { id: 4,  court: 'Introduction',  complet: 'Introduction du cours',         tag: 'ANNONCE',             type: 'corps'       },
  { id: 5,  court: 'Historicité',   complet: 'Historicité du problème',       tag: 'CONTEXTE HISTORIQUE', type: 'corps'       },
  { id: 6,  court: 'Définition',    complet: 'Définition du concept',         tag: 'DÉFINITION PRÉCISE',  type: 'corps'       },
  { id: 7,  court: 'Démonstration', complet: 'Démonstration de la découverte',tag: 'RAISONNEMENT',        type: 'corps'       },
  { id: 8,  court: 'Exemples',      complet: 'Exemples variés',               tag: 'ILLUSTRATION',        type: 'corps'       },
  { id: 9,  court: 'Conclusion',    complet: 'Conclusion doctrinale',         tag: 'SYNTHÈSE',            type: 'conclusion'  },
  { id: 10, court: 'Adage',         complet: 'Adage et ouverture',            tag: 'SAGESSE & OUVERTURE', type: 'conclusion'  },
];

/**
 * Profils pédagogiques (UX) — pas de noms de fournisseurs.
 * Le backend mappe vers Claude / OpenAI / Grok / DeepSeek + secours automatique.
 */
const LIRI_PEDAGOGIE_PROFILES = [
  {
    id: 'maitre_pedagogue',
    label: 'Maître Pédagogue',
    hint: 'Cours très structurés, doux, lisibles, profonds — priorité au moteur « rigueur & clarté ».',
  },
  {
    id: 'architecte',
    label: 'Architecte du Cours',
    hint: 'Plan, chapitres, découpage logique — priorité au moteur « structure & plan ».',
  },
  {
    id: 'cours_rapide',
    label: 'Cours Rapide',
    hint: 'Premier découpage ou brouillon rapide — priorité au moteur « vitesse ».',
  },
  {
    id: 'assistant_eco',
    label: 'Assistant Éco',
    hint: 'Versions économiques, brouillons simples, reformulations légères — priorité au moteur « coût ».',
  },
  {
    id: 'auto',
    label: 'Mode Auto',
    hint: 'Le système choisit le meilleur moteur disponible selon vos clés serveur (routeur intelligent).',
  },
];

const GENERATION_REFLECTION_STEPS = [
  { title: 'Analyse du sujet',       detail: 'Lecture du texte, du niveau et du contexte doctrinal.' },
  { title: 'Architecture LIRI',      detail: 'Structuration des 10 étapes : ouverture, corps, conclusion.' },
  { title: 'Fiches SmartBoard',      detail: 'Rédaction des contenus « vue élève » pour chaque étape.' },
  { title: 'MasterScripts',          detail: 'Discours oral, intentions pédagogiques et transitions.' },
  { title: 'Questions & vigilance',  detail: 'Questions à poser, réponses attendues et pièges fréquents.' },
  { title: 'Mindmap & doctrine',     detail: 'Carte mentale, loi doctrinale et adage final.' },
  { title: 'Cohérence pédagogique',  detail: 'Vérification du conflit cognitif et de la progression.' },
  { title: 'Structuration finale',   detail: 'Assemblage et validation du parcours au format JSON.' },
];

// ============================================================
//  PALETTE — DARK (LiveHostPage)
// ============================================================

const S = {
  // ── Couleurs dorées (identité Prorascience) ─────────────────
  gold:       '#C8960C',
  goldLight:  '#E8B84B',
  goldDim:    'rgba(200,150,12,0.14)',
  goldBorder: '1px solid rgba(200,150,12,0.55)',

  // ── Couleurs par type d'étape (adaptées fond sombre) ────────
  typeColor: {
    ouverture:  '#e0926a',
    corps:      '#e6b878',
    conclusion: '#C8960C',
  },
  typeBg: {
    ouverture:  'rgba(217,119,87,0.09)',
    corps:      'rgba(230,184,120,0.09)',
    conclusion: 'rgba(200,150,12,0.12)',
  },
  typeBorder: {
    ouverture:  'rgba(217,119,87,0.3)',
    corps:      'rgba(230,184,120,0.3)',
    conclusion: 'rgba(200,150,12,0.45)',
  },

  // ── Cartes ───────────────────────────────────────────────────
  card: {
    background:   'rgba(255,255,255,0.05)',
    border:       '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    padding:      '1.25rem 1.5rem',
  },
  cardSec: {
    background:   'rgba(255,255,255,0.03)',
    border:       '1px solid rgba(255,255,255,0.07)',
    borderRadius: '12px',
    padding:      '1.25rem 1.5rem',
  },

  // ── Labels ───────────────────────────────────────────────────
  label: {
    fontSize:      '10px',
    letterSpacing: '2.5px',
    textTransform: 'uppercase',
    color:         'rgba(255,255,255,0.38)',
    marginBottom:  '0.45rem',
    display:       'block',
  },

  // ── Texte ────────────────────────────────────────────────────
  t1: 'rgba(255,255,255,0.88)',
  t2: 'rgba(255,255,255,0.55)',
  t3: 'rgba(255,255,255,0.35)',

  // ── Fond + séparateurs ───────────────────────────────────────
  bg:         '#080910',
  bgCard:     'rgba(255,255,255,0.05)',
  bgCard2:    'rgba(255,255,255,0.03)',
  sep:        'rgba(255,255,255,0.09)',
};

// ============================================================
//  SOUS-COMPOSANTS
// ============================================================

function GenerationReflectionPanel({ steps, activeIndex, loading }) {
  const [spin, setSpin] = useState(0);
  useEffect(() => {
    if (!loading) return undefined;
    const id = setInterval(() => setSpin((s) => (s + 1) % 4), 380);
    return () => clearInterval(id);
  }, [loading]);

  const spinGlyph = ['◐', '◓', '◑', '◒'][spin];
  /** L'animation locale finit en ~18 s ; l'Edge (Claude) peut prendre 1–3 min — ne pas afficher « 100 % » tant que la requête n'a pas répondu. */
  const waitingForServer = Boolean(loading && steps.length > 0 && activeIndex >= steps.length - 1);
  const rawPct = steps.length ? Math.round(((activeIndex + 1) / steps.length) * 100) : 0;
  const pct = waitingForServer ? Math.min(88, rawPct) : rawPct;

  return (
    <div style={{
      marginTop: '0.75rem',
      padding: '1rem 1.1rem',
      borderRadius: '12px',
      border: S.goldBorder,
      background: 'linear-gradient(165deg, rgba(200,150,12,0.1), rgba(255,255,255,0.03))',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '0.65rem' }}>
        <span style={{ ...S.label, color: S.gold, marginBottom: 0, letterSpacing: '0.12em' }}>
          Réflexion du modèle
        </span>
        <span style={{ fontSize: '11px', fontWeight: 600, color: S.gold, fontFamily: 'ui-monospace, monospace' }}>
          {pct}%
        </span>
      </div>
      <div style={{ height: '4px', borderRadius: '99px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginBottom: '0.85rem' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: '99px',
          background: `linear-gradient(90deg, ${S.goldLight}, ${S.gold})`,
          transition: 'width 0.45s ease-out',
        }} />
      </div>
      <p style={{ fontSize: '10px', color: S.t3, margin: '0 0 0.75rem', lineHeight: 1.45 }}>
        {waitingForServer
          ? 'Les étapes locales sont terminées — la génération complète du JSON par l\'IA (serveur Supabase / Claude) est en cours. Patience…'
          : 'Chaque ligne indique ce que le système est en train de produire pour votre parcours.'}
      </p>
      {waitingForServer && (
        <div style={{
          fontSize: '11px', color: S.goldLight, marginBottom: '0.75rem', padding: '10px 12px',
          borderRadius: '10px', border: '1px solid rgba(200,150,12,0.35)', background: 'rgba(200,150,12,0.08)',
          lineHeight: 1.5,
        }}>
          <strong style={{ display: 'block', marginBottom: '4px' }}>Génération côté serveur</strong>
          L'appel peut prendre <strong>jusqu\'à 3 minutes</strong> (réseau + modèle). Ne fermez pas l\'onglet. Si une erreur survient (401, session), elle s\'affichera sous le bouton.
        </div>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 'min(52vh, 22rem)', overflowY: 'auto' }}>
        {steps.map((st, i) => {
          const done    = waitingForServer || i < activeIndex;
          const active  = !waitingForServer && i === activeIndex;
          const pending = !waitingForServer && i > activeIndex;
          return (
            <li key={st.title} style={{
              display: 'flex', gap: '10px', alignItems: 'flex-start',
              padding: '8px 6px', borderRadius: '10px', marginBottom: '4px',
              border: active ? `1.5px solid rgba(200,150,12,.6)` : '1.5px solid transparent',
              background: active ? S.goldDim : done ? 'rgba(217,119,87,0.07)' : 'transparent',
              opacity: pending ? 0.4 : 1,
              transition: 'background 0.25s, border-color 0.25s, opacity 0.25s',
            }}>
              <span style={{
                flexShrink: 0, width: '26px', height: '26px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 700,
                background: done ? 'rgba(217,119,87,0.18)' : active ? S.goldDim : 'rgba(255,255,255,0.06)',
                color: done ? '#e0926a' : active ? S.gold : S.t3,
                border: done ? '1px solid rgba(217,119,87,0.4)' : active ? S.goldBorder : '1px solid rgba(255,255,255,0.12)',
              }}>
                {done ? '✓' : active ? spinGlyph : i + 1}
              </span>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '12.5px', fontWeight: active ? 600 : 500, color: S.t1 }}>
                  {st.title}
                  {active && loading && (
                    <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: 500, color: S.gold }}> en cours…</span>
                  )}
                </p>
                <p style={{ margin: '3px 0 0', fontSize: '11px', lineHeight: 1.45, color: S.t2 }}>
                  {st.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SpiralIcon({ size = 32, opacity = 0.6 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" style={{ opacity }}>
      <path d="M30,30 m0,-18 a18,18 0 1,1 0,36 a12,12 0 1,0 0,-24 a6,6 0 1,1 0,12"
        fill="none" stroke={S.gold} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="30" cy="30" r="2" fill={S.gold} />
    </svg>
  );
}

function CrossIcon({ size = 28, opacity = 0.45 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" style={{ opacity }}>
      <path d="M30,5 L30,55 M5,30 L55,30" stroke={S.gold} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M30,5 a25,25 0 0,1 25,25 a25,25 0 0,1 -25,25 a25,25 0 0,1 -25,-25 a25,25 0 0,1 25,-25"
        fill="none" stroke={S.gold} strokeWidth="1" strokeDasharray="3 4" />
    </svg>
  );
}

function MindmapView({ cours }) {
  const W = 500, H = 360, cx = 250, cy = 180, r = 130;
  const typeOf  = (i) => STEPS_META[i].type;
  const colorOf = (i) => S.typeColor[typeOf(i)];
  const points  = STEPS_META.map((_, i) => {
    const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });

  return (
    <div style={{ textAlign: 'center', padding: '1rem 0', overflowX: 'auto' }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: '100%' }}>
        <circle cx={cx} cy={cy} r="52" fill={S.goldDim} stroke={S.gold} strokeWidth="1" />
        <text x={cx} y={cy - 14} textAnchor="middle" fill={S.gold} fontSize="9" fontWeight="600">
          {(cours?.titre || 'Cours').substring(0, 20)}
        </text>
        <text x={cx} y={cy} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="8">
          LIRI · PRORASCIENCE
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill={S.gold} fontSize="10" fontWeight="600">
          {cours?.loi_doctrinale || 'D + A = C'}
        </text>
        {points.map((p, i) => (
          <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y}
            stroke={colorOf(i)} strokeWidth="0.5" strokeDasharray="3 3" opacity="0.45" />
        ))}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="23" fill="rgba(13,15,34,0.95)" stroke={colorOf(i)} strokeWidth="1.5" />
            <text x={p.x} y={p.y - 5} textAnchor="middle" fill={colorOf(i)} fontSize="9" fontWeight="600">
              {i + 1}.
            </text>
            <text x={p.x} y={p.y + 6} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="8">
              {STEPS_META[i].court}
            </text>
          </g>
        ))}
      </svg>

      {cours?.adage_final && (
        <div style={{
          maxWidth: '480px', margin: '0.75rem auto',
          padding: '1rem', background: S.goldDim,
          borderRadius: '10px', border: S.goldBorder,
        }}>
          <span style={{ ...S.label, color: S.gold }}>Adage final</span>
          <p style={{ fontSize: '14px', fontStyle: 'italic', color: S.t1, lineHeight: 1.75, margin: '0 0 0.5rem' }}>
            "{cours.adage_final}"
          </p>
          <p style={{ fontSize: '12px', fontWeight: 600, color: S.gold, margin: 0 }}>
            {cours.loi_doctrinale}
          </p>
        </div>
      )}
    </div>
  );
}

function SmartBoardView({ etape, meta }) {
  const sb = etape?.smartboard || {};
  const t  = meta?.type || 'corps';

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
      <div style={{ background: S.goldDim, borderRadius: '12px', padding: '1.5rem', border: S.goldBorder, textAlign: 'center' }}>
        <span style={{ ...S.label, color: S.gold }}>Étape {etape.numero} · SmartBoard · Vue Élève · {etape.tag}</span>
        <h2 style={{ fontSize: '20px', fontWeight: 500, margin: '0.4rem 0 0.3rem', color: S.t1 }}>
          {sb.titre || meta?.complet}
        </h2>
        <p style={{ fontSize: '14px', color: S.t2, margin: 0, fontStyle: 'italic' }}>{sb.idee}</p>
      </div>

      <div style={S.card}>
        <span style={S.label}>Contenu</span>
        <p style={{ fontSize: '15px', lineHeight: 1.85, color: S.t1, margin: 0, whiteSpace: 'pre-wrap' }}>
          {sb.contenu}
        </p>
      </div>

      {sb.support_visuel && (
        <div style={{ background: S.typeBg[t], borderRadius: '12px', padding: '1rem 1.25rem', border: `1px solid ${S.typeBorder[t]}` }}>
          <span style={{ ...S.label, color: S.typeColor[t] }}>Support visuel</span>
          <p style={{ fontSize: '14px', color: S.typeColor[t], margin: 0, fontStyle: 'italic' }}>
            {sb.support_visuel}
          </p>
        </div>
      )}

      {sb.question_cle && (
        <div style={{
          background: S.bgCard2, borderRadius: '0 10px 10px 0',
          padding: '1rem 1rem 1rem 1.25rem',
          border: `1px solid ${S.sep}`, borderLeft: `3px solid ${S.gold}`,
        }}>
          <span style={S.label}>Question clé</span>
          <p style={{ fontSize: '17px', fontWeight: 500, color: S.t1, margin: 0, lineHeight: 1.5 }}>
            {sb.question_cle}
          </p>
        </div>
      )}
    </div>
  );
}

function BlockCard({ label, items, bg, color, border }) {
  return (
    <div style={{ background: bg, borderRadius: '12px', padding: '1rem', border: `1px solid ${border}` }}>
      <span style={{ ...S.label, color }}>{label}</span>
      <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
        {items.map((item, i) => (
          <li key={i} style={{ fontSize: '13px', color, marginBottom: '0.3rem', lineHeight: 1.55 }}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MasterScriptView({ etape, meta, coursData }) {
  const ms     = etape?.masterscript || {};
  const isLast = etape.numero === 10;

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
      <div style={{ ...S.cardSec, display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '26px', lineHeight: 1, flexShrink: 0, color: S.gold }}>◉</span>
        <div>
          <span style={{ ...S.label }}>MasterScript · Étape {etape.numero} · Vue Professeur</span>
          <p style={{ fontSize: '14px', color: S.t2, fontStyle: 'italic', margin: 0 }}>{ms.intention}</p>
        </div>
      </div>

      <div style={S.card}>
        <span style={S.label}>Script oral du professeur</span>
        <p style={{ fontSize: '15px', lineHeight: 1.9, color: S.t1, margin: 0, whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>
          {ms.script}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '0.75rem' }}>
        {ms.questions?.length > 0 && (
          <BlockCard label="Questions à poser" items={ms.questions}
            bg="rgba(217,119,87,0.08)" color="#e0926a" border="rgba(217,119,87,0.3)" />
        )}
        {ms.reponses_attendues?.length > 0 && (
          <BlockCard label="Réponses attendues" items={ms.reponses_attendues}
            bg="rgba(230,184,120,0.08)" color="#e6b878" border="rgba(230,184,120,0.3)" />
        )}
        {ms.pieges_erreurs?.length > 0 && (
          <BlockCard label="Pièges & erreurs fréquentes" items={ms.pieges_erreurs}
            bg="rgba(251,146,60,0.08)" color="#fb923c" border="rgba(251,146,60,0.35)" />
        )}
        {ms.transition && (
          <div style={{ background: S.goldDim, borderRadius: '12px', padding: '1rem', border: S.goldBorder }}>
            <span style={{ ...S.label, color: S.gold }}>Transition</span>
            <p style={{ fontSize: '13px', color: S.t2, margin: 0, fontStyle: 'italic', lineHeight: 1.65 }}>
              {ms.transition}
            </p>
          </div>
        )}
      </div>

      {isLast && coursData?.conseil_prof && (
        <div style={{ background: S.goldDim, borderRadius: '12px', padding: '1.25rem', border: S.goldBorder }}>
          <span style={{ ...S.label, color: S.gold }}>Conseil du Maître · Fin de cours</span>
          <p style={{ fontSize: '14px', color: S.t2, margin: 0, fontStyle: 'italic', lineHeight: 1.7 }}>
            {coursData.conseil_prof}
          </p>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: '100%', resize: 'vertical', fontSize: '14px',
  padding: '10px 12px', borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.07)',
  color: 'rgba(255,255,255,0.88)',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
};

const selectStyle = {
  width: '100%', padding: '9px 12px', fontSize: '14px',
  border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px',
  fontFamily: 'inherit', outline: 'none',
  background: 'rgba(255,255,255,0.07)',
  color: 'rgba(255,255,255,0.88)',
  cursor: 'pointer',
};

function ConfigScreen({ onGenerate, loading, error, reflectionStepIndex }) {
  const [sujet,    setSujet]    = useState('');
  const [niveau,   setNiveau]   = useState('intermédiaire');
  const [contexte, setContexte] = useState('Prorascience');
  const [profilPedagogique, setProfilPedagogique] = useState('auto');
  /** Après génération : ouvrir tout de suite le SmartBoard Designer (plan Copilot + Konva). */
  const [openDesignerAfterGenerate, setOpenDesignerAfterGenerate] = useState(true);

  return (
    <div style={{ minHeight: '580px', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: '580px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', marginBottom: '1rem', alignItems: 'center' }}>
            <SpiralIcon size={34} opacity={0.75} />
            <CrossIcon  size={26} opacity={0.5} />
            <SpiralIcon size={34} opacity={0.75} />
          </div>
          <p style={{ fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: S.t3, margin: '0 0 0.5rem' }}>
            NGOWAZULU · PRORASCIENCE · ISNA
          </p>
          <h1 style={{ fontSize: '26px', fontWeight: 500, margin: '0 0 0.25rem', color: S.t1 }}>
            Agent Pédagogique LIRI
          </h1>
          <p style={{ fontSize: '13px', color: S.t2, margin: 0 }}>
            Méthode d'enseignement vivant · SmartBoard + MasterScript
          </p>
        </div>

        <div style={{
          display: 'flex', flexDirection: 'column', gap: '1rem',
          opacity: loading ? 0.72 : 1, pointerEvents: loading ? 'none' : 'auto',
          transition: 'opacity 0.2s',
        }}>
          <div>
            <label style={S.label}>Sujet ou texte du cours</label>
            <textarea
              value={sujet}
              onChange={e => setSujet(e.target.value)}
              placeholder="Ex: La loi de l'encapsulation réciproque · La conscience et la matière · Le Vibratinium · L'origine de l'âme..."
              rows={4}
              style={inputStyle}
              onFocus={e  => { e.target.style.borderColor = 'rgba(200,150,12,.6)'; }}
              onBlur={e   => { e.target.style.borderColor = 'rgba(255,255,255,0.15)'; }}
            />
          </div>

          <div>
            <label style={S.label}>Style de génération (pédagogie)</label>
            <select
              value={profilPedagogique}
              onChange={(e) => setProfilPedagogique(e.target.value)}
              style={selectStyle}
            >
              {LIRI_PEDAGOGIE_PROFILES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <p style={{ fontSize: '11px', color: S.t2, margin: '6px 0 0', lineHeight: 1.45 }}>
              {LIRI_PEDAGOGIE_PROFILES.find((p) => p.id === profilPedagogique)?.hint}
            </p>
            <p style={{ fontSize: '11px', color: S.t3, margin: '6px 0 0', lineHeight: 1.45 }}>
              Si le moteur principal n'est pas disponible sur le serveur, un secours automatique s\'applique
              (vous en serez informé après génération).
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={S.label}>Niveau élèves</label>
              <select value={niveau} onChange={e => setNiveau(e.target.value)} style={selectStyle}>
                <option value="débutant">Débutant</option>
                <option value="intermédiaire">Intermédiaire</option>
                <option value="avancé">Avancé</option>
                <option value="initié Prorascience">Initié Prorascience</option>
              </select>
            </div>
            <div>
              <label style={S.label}>Contexte doctrinal</label>
              <select value={contexte} onChange={e => setContexte(e.target.value)} style={selectStyle}>
                <option value="Prorascience">Prorascience</option>
                <option value="NGOWAZULU">NGOWAZULU</option>
                <option value="ISNA">ISNA</option>
                <option value="Spiritualité africaine">Spiritualité africaine</option>
                <option value="Science générale">Science générale</option>
                <option value="Philosophie">Philosophie</option>
              </select>
            </div>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              cursor: loading ? 'default' : 'pointer',
              fontSize: '13px',
              color: S.t2,
              lineHeight: 1.45,
            }}
          >
            <input
              type="checkbox"
              checked={openDesignerAfterGenerate}
              onChange={(e) => setOpenDesignerAfterGenerate(e.target.checked)}
              disabled={loading}
              style={{ marginTop: '3px', width: '16px', height: '16px', accentColor: '#c9a227', flexShrink: 0 }}
            />
            <span>
              Ouvrir le <strong style={{ color: S.t1 }}>SmartBoard Designer</strong> dès la fin de la génération
              <span style={{ display: 'block', fontSize: '11px', color: S.t3, marginTop: '4px' }}>
                Plan Copilot + brouillon Konva (une scène par étape). Décochez pour rester dans l'agent et parcourir le cours généré.
              </span>
            </span>
          </label>

          <button
            onClick={() => onGenerate(sujet, niveau, contexte, profilPedagogique, openDesignerAfterGenerate)}
            disabled={loading || !sujet.trim()}
            style={{
              padding: '13px', fontSize: '14px', fontWeight: 500,
              border: S.goldBorder, color: loading ? S.t3 : S.gold,
              background: S.goldDim, borderRadius: '10px',
              cursor: loading || !sujet.trim() ? 'not-allowed' : 'pointer',
              letterSpacing: '0.5px', transition: 'all 0.15s',
            }}
          >
            {loading ? '⟳ Génération du parcours LIRI en cours...' : '⬡  Générer le parcours LIRI complet'}
          </button>

          {loading && (
            <GenerationReflectionPanel
              steps={GENERATION_REFLECTION_STEPS}
              activeIndex={Math.min(reflectionStepIndex, GENERATION_REFLECTION_STEPS.length - 1)}
              loading={loading}
            />
          )}

          {error && (
            <div style={{
              fontSize: '13px', color: '#ff7b7b', padding: '10px 14px',
              background: 'rgba(255,80,80,0.1)', borderRadius: '8px',
              border: '1px solid rgba(255,80,80,0.3)', marginTop: loading ? '0.75rem' : 0,
            }}>
              ⚠ {error}
            </div>
          )}

          <div style={{ padding: '1rem', background: S.bgCard2, borderRadius: '12px', border: `1px solid ${S.sep}` }}>
            <span style={S.label}>Structure du parcours LIRI</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {STEPS_META.map(s => (
                <span key={s.id} style={{
                  fontSize: '11px', padding: '3px 10px', borderRadius: '20px',
                  background: S.typeBg[s.type], color: S.typeColor[s.type],
                  border: `1px solid ${S.typeBorder[s.type]}`, fontWeight: 500,
                }}>
                  {s.id}. {s.court}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  COMPOSANT PRINCIPAL — LIRIAgent
// ============================================================

export default function LIRIAgent() {
  const navigate = useNavigate();
  const [phase,    setPhase]    = useState('config');
  const [cours,    setCours]    = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  /** Réponse serveur : bascule de moteur si clé manquante ou erreur */
  const [generationMeta, setGenerationMeta] = useState(null);
  const [reflectionStepIndex, setReflectionStepIndex] = useState(0);
  const reflectionTimerRef = useRef(null);
  const [architectBusy, setArchitectBusy] = useState(false);

  const [step, setStep] = useState(0);
  const [view, setView] = useState('smartboard');

  const [liveMode, setLiveMode] = useState(false);
  const [timer,    setTimer]    = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (liveMode) {
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
      setTimer(0);
    }
    return () => clearInterval(timerRef.current);
  }, [liveMode]);

  const formatTimer = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  useEffect(() => {
    if (!loading) {
      if (reflectionTimerRef.current) { clearInterval(reflectionTimerRef.current); reflectionTimerRef.current = null; }
      setReflectionStepIndex(0);
      return;
    }
    setReflectionStepIndex(0);
    reflectionTimerRef.current = setInterval(() => {
      setReflectionStepIndex((i) => {
        const max = GENERATION_REFLECTION_STEPS.length - 1;
        return i >= max ? max : i + 1;
      });
    }, 2300);
    return () => { if (reflectionTimerRef.current) { clearInterval(reflectionTimerRef.current); reflectionTimerRef.current = null; } };
  }, [loading]);

  const handleGenerate = async (sujet, niveau, contexte, profilPedagogique = 'auto', openDesignerAfterGenerate = true) => {
    if (!sujet.trim()) return;
    setLoading(true); setError(''); setGenerationMeta(null); setReflectionStepIndex(0);
    try {
      if (!isSupabaseConfigured) {
        throw new Error('Configuration Supabase manquante (variables d\'environnement sur le build).');
      }
      const anonKey = normalizeSupabaseAnonKey(import.meta.env.VITE_SUPABASE_ANON_KEY);
      if (!import.meta.env.VITE_SUPABASE_URL || !anonKey) {
        throw new Error('Configuration Supabase manquante (URL ou clé anonyme).');
      }

      const { data: { session: initialSession } } = await supabase.auth.getSession();
      if (!initialSession?.access_token) {
        throw new Error('Connectez-vous pour générer un parcours LIRI.');
      }
      const { data: refreshData } = await supabase.auth.refreshSession();
      const sessionAfterRefresh = refreshData?.session ?? initialSession;
      const accessToken = sessionAfterRefresh?.access_token;
      if (!accessToken) {
        throw new Error('Session expirée — reconnectez-vous.');
      }

      const { error: userErr } = await supabase.auth.getUser(accessToken);
      if (userErr) {
        throw new Error('Session invalide ou expirée — déconnectez-vous et reconnectez-vous.');
      }

      // Si la clé anon est mal formée (prod), la passerelle jose lève « Invalid Token or Protected Header formatting ».
      // Sinon : Bearer anon + x-user-jwt session (Edge lit x-user-jwt en premier).
      const headers =
        isLikelyJwt(anonKey) && isLikelyJwt(accessToken)
          ? {
              Authorization: `Bearer ${anonKey}`,
              'x-user-jwt': accessToken,
            }
          : {
              Authorization: `Bearer ${accessToken}`,
            };

      const payload = await invokeSupabaseFunction(supabase, 'liri-agent-course-generate', {
        body: { sujet, niveau, contexte, profil_pedagogique: profilPedagogique },
        headers,
        timeout: 180_000,
      });

      const parsed = payload?.cours;
      if (!parsed || typeof parsed !== 'object') throw new Error('Réponse serveur invalide.');
      if (!parsed.etapes || parsed.etapes.length < 1) throw new Error('Structure du cours incorrecte.');

      setGenerationMeta(payload?.meta && typeof payload.meta === 'object' ? payload.meta : null);
      setCours(parsed);
      setStep(0);
      setView('smartboard');
      if (openDesignerAfterGenerate) {
        saveLiriAgentCoursForKonvaDesigner(parsed);
        navigate('/studio/smartboard-designer', {
          state: { liriToKonva: { cours: parsed } },
        });
      } else {
        setPhase('cours');
      }
    } catch (e) {
      const name = e?.name || '', msg = e?.message || '';
      if (name === 'AbortError' || msg.includes('aborted')) {
        setError('Délai dépassé — réessayez ou raccourcissez le texte.');
      } else {
        setError(msg || 'Erreur inconnue lors de la génération.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleArchitectThenLive = async () => {
    if (!cours) return;
    setArchitectBusy(true);
    setError('');
    try {
      if (!isSupabaseConfigured) {
        throw new Error('Configuration Supabase manquante (variables d\'environnement sur le build).');
      }
      const anonKey = normalizeSupabaseAnonKey(import.meta.env.VITE_SUPABASE_ANON_KEY);
      if (!import.meta.env.VITE_SUPABASE_URL || !anonKey) {
        throw new Error('Configuration Supabase manquante (URL ou clé anonyme).');
      }
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      if (!initialSession?.access_token) {
        throw new Error('Connectez-vous pour lancer SmartBoard Architect.');
      }
      const { data: refreshData } = await supabase.auth.refreshSession();
      const sessionAfterRefresh = refreshData?.session ?? initialSession;
      const accessToken = sessionAfterRefresh?.access_token;
      if (!accessToken) throw new Error('Session expirée — reconnectez-vous.');
      const { error: userErr } = await supabase.auth.getUser(accessToken);
      if (userErr) {
        throw new Error('Session invalide ou expirée — déconnectez-vous et reconnectez-vous.');
      }
      const headers =
        isLikelyJwt(anonKey) && isLikelyJwt(accessToken)
          ? { Authorization: `Bearer ${anonKey}`, 'x-user-jwt': accessToken }
          : { Authorization: `Bearer ${accessToken}` };

      const sourceText = buildLiriCourseTextForLiveStudio(cours);
      if (!sourceText.trim()) throw new Error('Texte du cours vide.');

      const designCanvas = resolveArchitectDesignCanvasForApiRequest();
      // L'edge smartboard-ia-generate peut être ABSENTE (404 en prod) : son échec ne doit
      // JAMAIS bloquer l'export — le cours structuré suffit (Step6 construit le deck
      // localement via liriCourseToIAResponse). L'Architect n'est qu'un raffinement.
      let data = null;
      try {
        data = await invokeSupabaseFunction(supabase, 'smartboard-ia-generate', {
          body: {
            sourceText,
            lang: 'fr',
            fast: true,
            ...(designCanvas ? { designCanvas } : {}),
          },
          headers,
          timeout: 240_000,
        });
      } catch (invokeErr) {
        console.warn('[LIRIAgent] smartboard-ia-generate indisponible → import direct du cours structuré', invokeErr?.message);
        data = null;
      }
      if (data?.slides?.length) {
        savePendingArchitectForLiveStudio(data);
      }
      const text = sourceText;
      const title = String(cours?.titre || '').trim() || 'Cours LIRI';
      savePendingLiriCourseForLiveStudio(cours);
      navigate('/studio/live?liriImport=1', {
        state: { liriAgentImport: { text, title, cours } },
      });
    } catch (e) {
      const name = e?.name || '';
      const msg = e?.message || '';
      if (name === 'AbortError' || msg.includes('aborted')) {
        setError('Délai dépassé — réessayez ou raccourcissez le texte.');
      } else {
        setError(msg || 'Erreur SmartBoard Architect.');
      }
    }
    setArchitectBusy(false);
  };

  useEffect(() => {
    if (phase !== 'cours') return undefined;
    const onKey = (e) => {
      const t = e.target;
      if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.tagName === 'SELECT' || t?.isContentEditable) return;
      if (e.key === 'ArrowRight') setStep((s) => Math.min(9, s + 1));
      if (e.key === 'ArrowLeft')  setStep((s) => Math.max(0, s - 1));
      if (e.key === 'e') setView('smartboard');
      if (e.key === 'p') setView('masterscript');
      if (e.key === 'm') setView('mindmap');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  // ── Écran de configuration ────────────────────────────────
  if (phase === 'config') {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', background: S.bg, color: S.t1, minHeight: '580px' }}>
        <ConfigScreen
          onGenerate={handleGenerate}
          loading={loading}
          error={error}
          reflectionStepIndex={reflectionStepIndex}
        />
      </div>
    );
  }

  // ── Écran cours ───────────────────────────────────────────
  const etape = cours?.etapes?.[step];
  const meta  = STEPS_META[step];
  const total = cours?.etapes?.length || 10;

  const navBtnStyle = (active) => ({
    flexShrink: 0, padding: '5px 11px', fontSize: '12px', fontWeight: 500,
    whiteSpace: 'nowrap', borderRadius: '8px', cursor: 'pointer',
    border: active ? 'rgba(200,150,12,.55)' : `1px solid ${S.sep}`,
    borderStyle: active ? 'solid' : undefined,
    borderWidth: active ? '1px' : undefined,
    borderColor: active ? 'rgba(200,150,12,.55)' : S.sep,
    color: active ? S.gold : S.t2,
    background: active ? S.goldDim : 'transparent',
    transition: 'all .12s',
  });

  const viewBtnStyle = (active) => ({
    padding: '4px 10px', fontSize: '12px', fontWeight: 500, borderRadius: '8px', cursor: 'pointer',
    border: `1px solid ${active ? 'rgba(200,150,12,.55)' : S.sep}`,
    color: active ? S.gold : S.t3,
    background: active ? S.goldDim : 'transparent',
    transition: 'all .12s',
  });

  return (
    <div style={{ minHeight: '700px', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif', background: S.bg, color: S.t1 }}>

      {/* ── Top bar ───────────────────────────────────────── */}
      {generationMeta?.message && (generationMeta?.bascule || generationMeta?.profil_demande === 'auto') && (
        <div
          style={{
            padding: '8px 16px',
            fontSize: '12px',
            color: S.t2,
            background: generationMeta?.bascule ? 'rgba(200,150,12,0.12)' : 'rgba(230,184,120,0.08)',
            borderBottom: `1px solid ${S.sep}`,
            lineHeight: 1.5,
          }}
        >
          ℹ {String(generationMeta.message)}
        </div>
      )}

      <div style={{
        padding: '10px 16px', borderBottom: `1px solid ${S.sep}`,
        display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
        background: 'rgba(255,255,255,0.02)',
      }}>
        <SpiralIcon size={26} opacity={0.65} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: S.t3, margin: 0 }}>
            Prorascience · NGOWAZULU
          </p>
          <p style={{ fontSize: '15px', fontWeight: 500, color: S.t1, margin: '0 0 1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cours?.titre || 'Cours LIRI'}
          </p>
          {cours?.sous_titre && (
            <p style={{ fontSize: '11px', color: S.t2, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic' }}>
              {cours.sous_titre}
            </p>
          )}
        </div>

        {/* Objectif + durée */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
          {cours?.duree_estimee && (
            <span style={{
              fontSize: '11px', fontWeight: 600, color: S.gold,
              padding: '2px 8px', borderRadius: '20px',
              border: S.goldBorder, background: S.goldDim,
              fontFamily: 'ui-monospace, monospace',
            }}>
              ⏱ {cours.duree_estimee}
            </span>
          )}
          {cours?.objectif && (
            <span style={{
              fontSize: '10px', color: S.t3, maxWidth: '220px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              textAlign: 'right',
            }}
              title={cours.objectif}
            >
              {cours.objectif}
            </span>
          )}
        </div>

        {liveMode && (
          <div style={{
            fontSize: '18px', fontWeight: 500, fontFamily: 'monospace',
            color: S.gold, padding: '3px 12px', border: S.goldBorder, borderRadius: '8px',
          }}>
            {formatTimer(timer)}
          </div>
        )}

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => {
              if (!cours) return;
              saveLiriAgentCoursForKonvaDesigner(cours);
              navigate('/studio/smartboard-designer', {
                state: { liriToKonva: { cours } },
              });
            }}
            style={{
              fontSize: '11px', padding: '5px 10px', borderRadius: '8px', cursor: 'pointer',
              border: '1px solid rgba(230,184,120,0.45)', color: '#93c5fd',
              background: 'rgba(230,184,120,0.1)',
            }}
            title="Étape 3 du parcours : éditeur Konva, plan Copilot, Coach slide par slide"
          >
            ③ Designer + Coach
          </button>
          <button
            type="button"
            disabled={architectBusy}
            onClick={handleArchitectThenLive}
            style={{
              fontSize: '11px', padding: '5px 10px', borderRadius: '8px', cursor: architectBusy ? 'wait' : 'pointer',
              border: '1px solid rgba(212,175,55,0.55)', color: '#fcd34d',
              background: 'rgba(212,175,55,0.14)',
              opacity: architectBusy ? 0.75 : 1,
            }}
            title="Génère les slides (SmartBoard Architect) puis ouvre le studio — aperçu prêt à intégrer"
          >
            {architectBusy ? '… Architect' : '② Architect → live'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!cours) return;
              const text = buildLiriCourseTextForLiveStudio(cours);
              const title = String(cours?.titre || '').trim() || 'Cours LIRI';
              savePendingLiriCourseForLiveStudio(cours);
              navigate('/studio/live?liriImport=1', {
                state: { liriAgentImport: { text, title, cours } },
              });
            }}
            style={{
              fontSize: '11px', padding: '5px 10px', borderRadius: '8px', cursor: 'pointer',
              border: '1px solid rgba(200,150,12,0.45)', color: S.gold,
              background: 'rgba(200,150,12,0.12)',
            }}
            title="Colle le texte à l'étape 6 ; vous lancez Architect ou la mindmap sur place"
          >
            ② Live (texte seul)
          </button>
          <button
            onClick={() => setLiveMode(l => !l)}
            style={{
              fontSize: '11px', padding: '5px 10px', borderRadius: '8px', cursor: 'pointer',
              border: liveMode ? S.goldBorder : `1px solid ${S.sep}`,
              color: liveMode ? S.gold : S.t2,
              background: liveMode ? S.goldDim : 'transparent',
            }}
          >
            {liveMode ? '◉ LIVE' : '○ LIVE'}
          </button>
          <button
            onClick={() => { setPhase('config'); setLiveMode(false); }}
            style={{ fontSize: '11px', padding: '5px 10px', border: `1px solid ${S.sep}`, color: S.t2, background: 'transparent', borderRadius: '8px', cursor: 'pointer' }}
          >
            ← Nouveau cours
          </button>
        </div>
      </div>

      <div
        style={{
          padding: '8px 16px',
          borderBottom: `1px solid ${S.sep}`,
          fontSize: '11px',
          color: S.t2,
          lineHeight: 1.5,
          background: 'rgba(200,150,12,0.06)',
        }}
      >
        <span style={{ fontWeight: 600, color: S.gold }}>Parcours recommandé</span>
        {' — '}
        ① Cours LIRI (cette page) · ② Studio live :{' '}
        <em style={{ color: S.t3 }}>Architect → live</em> génère les slides puis ouvre l'aperçu, ou{' '}
        <em style={{ color: S.t3 }}>Live (texte seul)</em> pour coller le cours et lancer Architect à la main · ③{' '}
        <em style={{ color: S.t3 }}>Designer + Coach</em> pour affiner chaque diapo (Copilot Konva).
      </div>

      {/* ── Navigation étapes ─────────────────────────────── */}
      <div style={{
        display: 'flex', overflowX: 'auto', padding: '8px 12px',
        gap: '5px', borderBottom: `1px solid ${S.sep}`,
        scrollbarWidth: 'none',
      }}>
        {STEPS_META.map((s, i) => (
          <button key={s.id} onClick={() => setStep(i)} style={navBtnStyle(step === i)}>
            {s.id}. {s.court}
          </button>
        ))}
      </div>

      {/* ── Barre vue + tag ───────────────────────────────── */}
      <div style={{
        display: 'flex', padding: '7px 14px', gap: '6px',
        alignItems: 'center', borderBottom: `1px solid ${S.sep}`,
        background: 'rgba(255,255,255,0.01)',
      }}>
        <span style={{ fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: S.typeColor[meta.type] }}>
          {etape?.tag || meta.tag}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
          {[['smartboard', '◈ Élève'], ['masterscript', '◉ Professeur'], ['mindmap', '⬡ Mindmap']].map(([v, label]) => (
            <button key={v} onClick={() => setView(v)} style={viewBtnStyle(view === v)}>{label}</button>
          ))}
        </div>
      </div>

      {/* ── Contenu principal ─────────────────────────────── */}
      <div style={{ flex: 1, padding: '14px', overflowY: 'auto' }}>
        {view === 'mindmap' ? (
          <MindmapView cours={cours} />
        ) : view === 'smartboard' ? (
          <SmartBoardView etape={etape} meta={meta} />
        ) : (
          <MasterScriptView etape={etape} meta={meta} coursData={cours} />
        )}
      </div>

      {/* ── Navigation bas ────────────────────────────────── */}
      {view !== 'mindmap' && (
        <div style={{
          padding: '10px 16px', borderTop: `1px solid ${S.sep}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.02)',
        }}>
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            style={{ padding: '7px 14px', border: `1px solid ${S.sep}`, color: S.t2, background: 'transparent', borderRadius: '8px', opacity: step === 0 ? 0.3 : 1, cursor: step === 0 ? 'default' : 'pointer' }}
          >
            ← Précédent
          </button>

          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: S.t3, margin: '0 0 4px' }}>{step + 1} / {total}</p>
            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
              {Array.from({ length: total }).map((_, i) => (
                <div key={i} onClick={() => setStep(i)} style={{
                  width: '7px', height: '7px', borderRadius: '50%', cursor: 'pointer',
                  background: i === step ? S.gold : 'rgba(255,255,255,0.18)',
                  transition: 'background 0.2s',
                }} />
              ))}
            </div>
          </div>

          <button
            onClick={() => setStep(s => Math.min(total - 1, s + 1))}
            disabled={step >= total - 1}
            style={{ padding: '7px 14px', border: `1px solid ${S.sep}`, color: S.t2, background: 'transparent', borderRadius: '8px', opacity: step >= total - 1 ? 0.3 : 1, cursor: step >= total - 1 ? 'default' : 'pointer' }}
          >
            Suivant →
          </button>
        </div>
      )}

      {/* ── Raccourcis clavier (info) ─────────────────────── */}
      <div style={{ textAlign: 'center', padding: '4px 0 8px', fontSize: '10px', color: S.t3 }}>
        ← → naviguer &nbsp;·&nbsp; E = Élève &nbsp;·&nbsp; P = Professeur &nbsp;·&nbsp; M = Mindmap
      </div>
    </div>
  );
}
