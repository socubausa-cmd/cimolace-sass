// ─────────────────────────────────────────────────────────────────────────────
// ConsultationScriptPanel — « Conducteur » (Master Script) de la téléconsultation.
//
// RÉUTILISE `MasterScriptPanel` (le conducteur du studio Formation, découplé) tel
// quel : liste des sections, édition inline, et mode PROMPTEUR plein écran (auto-
// scroll). On NE modifie PAS ce composant partagé — on lui fournit juste l'état +
// les callbacks via un hook local.
//
// PERSISTENCE (v1) : locale par session (`localStorage: liri:consult-script:<id>`).
//   → survit au rechargement / à un aller-retour vers le studio de préparation,
//     sur le même poste. Un branchement backend (par session téléconsult) pourra
//     remplacer `loadSections`/`persist` sans toucher au reste.
//
// IA : les boutons « Améliorer / Enrichir / Simplifier » de chaque carte appellent
//   `aiReformulate` (NeuronQ, déjà dans le repo, sans couplage). Best-effort : si
//   l'edge est indisponible, la section reste inchangée (pas de bouton mort dur —
//   le spinner s'arrête et rien n'est écrasé).
//
// Accent : `MasterScriptPanel` peint avec `var(--school-accent)` (non défini hors
//   Formation) → on pose la variable sur le conteneur = ambre LIRI.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { FileText, X } from 'lucide-react';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — composant .jsx partagé (pas de déclaration de types)
import MasterScriptPanel from '@/components/liri/live-room/MasterScriptPanel';
import { aiReformulate } from '@/lib/neuroInkAi';

// Thème raccord aux panneaux de ConsultationRoom (frostés chauds + filet ivoire).
const PANEL_BG = 'rgba(48,48,46,0.97)';
const PANEL_BORDER = '1px solid rgba(245,244,238,0.09)';
const GOLD = '#d4a36a';

export interface ScriptSection {
  id: string;
  content: string;
  ai_content?: string | null;
  /** Diapo associée (0-based) — utile quand un deck préparé est présenté. */
  slide_index?: number | null;
  title?: string;
}

const keyFor = (sessionId: string) => `liri:consult-script:${sessionId}`;

function loadSections(sessionId: string | null): ScriptSection[] {
  if (!sessionId) return [];
  try {
    const raw = localStorage.getItem(keyFor(sessionId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ScriptSection[]) : [];
  } catch {
    return [];
  }
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `s_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
  }
}

/**
 * État du conducteur + persistance locale par session. Toutes les mutations
 * passent par `mutate` (forme fonctionnelle → pas de closure périmée) qui écrit
 * aussitôt dans localStorage.
 */
export function useConsultationScript(sessionId: string | null) {
  const [sections, setSections] = useState<ScriptSection[]>(() => loadSections(sessionId));
  const [improving, setImproving] = useState<string | null>(null);

  // Miroir pour lire l'état courant dans un handler asynchrone (IA) sans le capturer.
  const sectionsRef = useRef<ScriptSection[]>(sections);
  useEffect(() => {
    sectionsRef.current = sections;
  });

  // Recharge au changement de session (nouvelle consultation).
  useEffect(() => {
    setSections(loadSections(sessionId));
  }, [sessionId]);

  const mutate = useCallback(
    (fn: (prev: ScriptSection[]) => ScriptSection[]) => {
      setSections((prev) => {
        const next = fn(prev);
        if (sessionId) {
          try {
            localStorage.setItem(keyFor(sessionId), JSON.stringify(next));
          } catch {
            /* quota / mode privé : on garde l'état en mémoire */
          }
        }
        return next;
      });
    },
    [sessionId],
  );

  const addSection = useCallback(
    (content: string, slideIndex: number | null) => {
      mutate((prev) => [...prev, { id: newId(), content, slide_index: slideIndex ?? null }]);
    },
    [mutate],
  );

  const updateSection = useCallback(
    (id: string, patch: Partial<ScriptSection>) => {
      mutate((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    },
    [mutate],
  );

  const deleteSection = useCallback(
    (id: string) => {
      mutate((prev) => prev.filter((s) => s.id !== id));
    },
    [mutate],
  );

  const moveSection = useCallback(
    (id: string, dir: 'up' | 'down') => {
      mutate((prev) => {
        const i = prev.findIndex((s) => s.id === id);
        if (i < 0) return prev;
        const j = dir === 'up' ? i - 1 : i + 1;
        if (j < 0 || j >= prev.length) return prev;
        const next = prev.slice();
        [next[i], next[j]] = [next[j], next[i]];
        return next;
      });
    },
    [mutate],
  );

  const improveSection = useCallback(
    async (id: string, _mode: string) => {
      if (improving) return;
      const s = sectionsRef.current.find((x) => x.id === id);
      if (!s || !s.content?.trim()) return;
      setImproving(id);
      try {
        const out: unknown = await aiReformulate({ rawText: s.content, sessionId: sessionId || undefined });
        const text =
          typeof out === 'string'
            ? out
            : ((out as Record<string, string> | null)?.text ||
              (out as Record<string, string> | null)?.result ||
              (out as Record<string, string> | null)?.reformulated ||
              '');
        if (text && text.trim()) {
          mutate((prev) => prev.map((x) => (x.id === id ? { ...x, ai_content: text.trim() } : x)));
        }
      } catch {
        /* best-effort : l'IA peut être indisponible → on n'écrase rien */
      } finally {
        setImproving(null);
      }
    },
    [improving, mutate, sessionId],
  );

  return { sections, improving, addSection, updateSection, deleteSection, moveSection, improveSection };
}

/**
 * Colonne de droite « Conducteur » — en-tête + fermeture, à monter comme
 * CopilotPanel / ConsultationRecall (un seul panneau droite ouvert à la fois).
 */
export default function ConsultationScriptPanel({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose: () => void;
}) {
  const script = useConsultationScript(sessionId);
  return (
    <div
      style={{
        width: 344,
        flexShrink: 0,
        background: PANEL_BG,
        borderLeft: PANEL_BORDER,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        // MasterScriptPanel peint avec var(--school-accent) → ambre LIRI.
        ['--school-accent' as string]: GOLD,
      } as CSSProperties}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <FileText size={16} color={GOLD} aria-hidden="true" />
        <span style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>Conducteur</span>
        <button
          onClick={onClose}
          aria-label="Fermer le conducteur"
          style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'inline-flex' }}
        >
          <X size={16} />
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12 }}>
        <MasterScriptPanel
          sections={script.sections}
          improving={script.improving}
          onAddSection={script.addSection}
          onUpdateSection={script.updateSection}
          onDeleteSection={script.deleteSection}
          onMoveSection={script.moveSection}
          onImproveSection={script.improveSection}
          totalSlides={1}
        />
      </div>
    </div>
  );
}
