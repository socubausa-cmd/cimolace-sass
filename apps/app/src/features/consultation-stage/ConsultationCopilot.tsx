// ─────────────────────────────────────────────────────────────────────────────
// ConsultationCopilot — Copilote IA (NeuroInk) pour la SALLE DE TÉLÉCONSULTATION.
//
// Réutilise tel quel le hook hôte `useNeuroInkAi({ lang:'fr', sessionId })` (déjà
// branché sur les briques IA déployées : vision-describe, architect-structured,
// generate-visual-image). Les quatre actions hôte appliquent le résultat AU
// TABLEAU via l'event `LIRI_LIVE_ARCHITECT_APPLY` (écouté côté tableau du live) —
// ce panneau ne fait QUE déclencher + afficher l'état (chargement / lecture /
// erreur). Aucune mutation de canvas ici.
//
// Pensé pour le mode « Tableau » de ConsultationRoom (le praticien explique en
// dessinant) : le praticien écrit, puis demande à l'IA de Comprendre / Mettre au
// propre / Présenter / Illustrer.
//
// AUTONOMIE : self-contained, styles inline (mêmes conventions que
// ConsultationRoom — fond sombre, accent GOLD, icônes lucide-react). Si une
// dépendance n'est pas satisfaite hors live (pas de tableau monté, edge IA
// indisponible…), le hook route déjà ses échecs vers `state.error` ; on ajoute
// un try/catch défensif autour de chaque déclenchement pour ne JAMAIS casser
// l'UI ni le rendu. Le composant n'importe rien d'autre que le hook + lucide.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useState } from 'react';
import {
  Sparkles,
  ScanEye,
  WandSparkles,
  LayoutTemplate,
  ImagePlus,
  Loader2,
  X,
  ChevronDown,
} from 'lucide-react';
import { useNeuroInkAi } from '@/components/liri/live-room/useNeuroInkAi';

const GOLD = '#b08d57';
const PANEL_BG = 'rgba(22,22,24,0.96)';
const BORDER = 'rgba(255,255,255,0.08)';

// ── Types locaux (le hook est en JS sans .d.ts → on déclare la forme utilisée) ─
type NeuroInkActiveKind = 'comprehend' | 'cleanup' | 'present' | 'illustrate' | null;

interface NeuroInkAiState {
  enabled?: boolean;
  premium?: boolean;
  busy?: boolean;
  activeKind?: NeuroInkActiveKind;
  comprehension?: { description?: string; provider?: string | null; at?: number } | null;
  error?: string | null;
  suggestions?: Array<{ key: string; kind: string; label: string; text?: string }>;
}

interface NeuroInkAiController {
  state: NeuroInkAiState;
  comprehend: () => Promise<unknown>;
  cleanup: () => Promise<unknown>;
  present: () => Promise<unknown>;
  illustrate: (promptOverride?: string) => Promise<unknown>;
  runSuggestion: (s: { key: string; kind: string }) => Promise<unknown> | void;
  dismissSuggestion: (key: string) => void;
  setEnabled: (v: boolean) => void;
  setPremium: (v: boolean) => void;
  clearError: () => void;
}

// Le hook hôte est volontairement typé `any` à l'import (module JS) ; on le
// re-type localement pour un usage propre côté TS.
const useCopilotAi = useNeuroInkAi as unknown as (opts: {
  lang?: string;
  sessionId?: string;
}) => NeuroInkAiController;

type ActionDef = {
  kind: Exclude<NeuroInkActiveKind, null>;
  label: string;
  hint: string;
  Icon: typeof ScanEye;
  run: (ai: NeuroInkAiController) => Promise<unknown> | void;
};

const ACTIONS: ActionDef[] = [
  { kind: 'comprehend', label: 'Comprendre', hint: 'Lire le tableau (IA vision)', Icon: ScanEye, run: (ai) => ai.comprehend() },
  { kind: 'cleanup', label: 'Mettre au propre', hint: 'Réécrire proprement le contenu', Icon: WandSparkles, run: (ai) => ai.cleanup() },
  { kind: 'present', label: 'Présentation', hint: 'Transformer en diapo structurée', Icon: LayoutTemplate, run: (ai) => ai.present() },
  { kind: 'illustrate', label: 'Illustration', hint: 'Générer un visuel du concept', Icon: ImagePlus, run: (ai) => ai.illustrate() },
];

export interface ConsultationCopilotProps {
  /** Identifiant de session de téléconsultation (transmis au hook IA). */
  sessionId?: string | null;
  /** Repliable : ouvert par défaut. */
  defaultOpen?: boolean;
  /** Position fixe par défaut (panneau flottant). false = rendu inline (dans un parent). */
  floating?: boolean;
  /** Style supplémentaire du conteneur racine. */
  style?: React.CSSProperties;
}

export default function ConsultationCopilot({
  sessionId,
  defaultOpen = true,
  floating = true,
  style,
}: ConsultationCopilotProps) {
  // Le hook DOIT être appelé inconditionnellement (règles des hooks). Le module
  // est vérifié présent ; le store sous-jacent a des valeurs par défaut sûres,
  // donc l'appel ne jette pas même hors d'un tableau live monté.
  const ai = useCopilotAi({ lang: 'fr', sessionId: sessionId ?? undefined });
  const state: NeuroInkAiState = ai?.state || {};
  const { enabled, premium, busy, activeKind, comprehension, error } = state;
  const suggestions = state.suggestions || [];

  const [open, setOpen] = useState<boolean>(defaultOpen);

  // Déclencheur défensif : le hook gère déjà ses erreurs (→ state.error), mais on
  // ne laisse JAMAIS une exception remonter et casser le rendu de la salle.
  const safeRun = useCallback((fn?: (ai: NeuroInkAiController) => Promise<unknown> | void) => {
    try {
      const r = fn?.(ai);
      if (r && typeof (r as Promise<unknown>).catch === 'function') {
        (r as Promise<unknown>).catch(() => { /* déjà routé vers state.error */ });
      }
    } catch {
      /* dépendance non satisfaite hors live — silencieux, l'UI reste stable */
    }
  }, [ai]);

  const safeToggleEnabled = useCallback((v: boolean) => {
    try { ai?.setEnabled?.(v); } catch { /* ignore */ }
  }, [ai]);
  const safeSetPremium = useCallback((v: boolean) => {
    try { ai?.setPremium?.(v); } catch { /* ignore */ }
  }, [ai]);
  const safeClearError = useCallback(() => {
    try { ai?.clearError?.(); } catch { /* ignore */ }
  }, [ai]);
  const safeDismiss = useCallback((key: string) => {
    try { ai?.dismissSuggestion?.(key); } catch { /* ignore */ }
  }, [ai]);

  const rootStyle: React.CSSProperties = floating
    ? {
        position: 'fixed',
        top: 84,
        right: 16,
        width: 268,
        zIndex: 2147483400,
        ...style,
      }
    : { width: 268, ...style };

  return (
    <div style={rootStyle}>
      {/* En-tête repliable */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="Copilote IA du tableau"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '9px 12px',
          borderRadius: open ? '12px 12px 0 0' : 12,
          border: `1px solid ${BORDER}`,
          borderBottom: open ? 'none' : `1px solid ${BORDER}`,
          background: PANEL_BG,
          color: '#fff',
          cursor: 'pointer',
          font: 'inherit',
        }}
      >
        <Sparkles size={15} color={GOLD} aria-hidden="true" />
        <span style={{ fontSize: 13, fontWeight: 600 }}>Copilote IA</span>
        <ChevronDown
          size={15}
          aria-hidden="true"
          style={{ marginLeft: 'auto', color: '#9ca3af', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        />
      </button>

      {open ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 9,
            padding: 12,
            borderRadius: '0 0 12px 12px',
            border: `1px solid ${BORDER}`,
            borderTop: 'none',
            background: PANEL_BG,
            boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
          }}
        >
          {/* Activer / désactiver le copilote */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>Lecture & transformation du tableau</span>
            <button
              type="button"
              onClick={() => safeToggleEnabled(!enabled)}
              aria-pressed={Boolean(enabled)}
              style={{
                padding: '3px 10px',
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                fontSize: 10,
                fontWeight: 700,
                background: enabled ? GOLD : 'rgba(255,255,255,0.08)',
                color: enabled ? '#1a1a1a' : '#cbd5e1',
              }}
            >
              {enabled ? 'Activé' : 'Activer'}
            </button>
          </div>

          {enabled ? (
            <>
              {/* Palier de coût Éco / Premium */}
              <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: `1px solid ${BORDER}` }}>
                <SegBtn active={!premium} onClick={() => safeSetPremium(false)} label="⚡ Éco" />
                <SegBtn active={Boolean(premium)} onClick={() => safeSetPremium(true)} label="✦ Premium" />
              </div>
              <p style={{ margin: '-3px 2px 0', fontSize: 9, color: '#6b7280', lineHeight: 1.4 }}>
                {premium ? 'Claude / OpenAI — qualité max' : 'DeepSeek / Mistral — économie'}
              </p>

              {/* Les quatre actions hôte */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ACTIONS.map(({ kind, label, hint, Icon, run }) => {
                  const isActive = Boolean(busy) && activeKind === kind;
                  return (
                    <button
                      key={kind}
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => safeRun(run)}
                      title={hint}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9,
                        width: '100%',
                        padding: '8px 11px',
                        borderRadius: 10,
                        border: `1px solid ${BORDER}`,
                        cursor: busy ? 'default' : 'pointer',
                        textAlign: 'left',
                        background: 'rgba(176,141,87,0.10)',
                        color: '#f3ead6',
                        fontSize: 12.5,
                        fontWeight: 600,
                        opacity: busy && !isActive ? 0.5 : 1,
                      }}
                    >
                      {isActive ? (
                        <Loader2 size={15} aria-hidden="true" style={{ flexShrink: 0, animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <Icon size={15} aria-hidden="true" style={{ flexShrink: 0, color: GOLD }} />
                      )}
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                    </button>
                  );
                })}
              </div>

              {busy ? (
                <p style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontSize: 11, color: 'rgba(176,141,87,0.85)' }}>
                  <Loader2 size={12} aria-hidden="true" style={{ animation: 'spin 1s linear infinite' }} /> IA en cours…
                </p>
              ) : null}

              {error ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '7px 9px',
                    borderRadius: 9,
                    border: '1px solid rgba(244,63,94,0.3)',
                    background: 'rgba(244,63,94,0.08)',
                  }}
                >
                  <p style={{ margin: 0, fontSize: 11, lineHeight: 1.4, color: '#fecdd3' }}>{error}</p>
                  <button
                    type="button"
                    onClick={safeClearError}
                    aria-label="Fermer l'erreur"
                    style={{ flexShrink: 0, background: 'transparent', border: 'none', color: '#fda4af', cursor: 'pointer', display: 'inline-flex' }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : null}

              {comprehension?.description ? (
                <div style={{ padding: '8px 10px', borderRadius: 9, border: `1px solid ${BORDER}`, background: 'rgba(0,0,0,0.3)' }}>
                  <p style={{ margin: '0 0 3px', fontSize: 9, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'rgba(176,141,87,0.75)' }}>
                    Lecture IA
                  </p>
                  <p style={{ margin: 0, maxHeight: 96, overflowY: 'auto', fontSize: 11.5, lineHeight: 1.45, color: 'rgba(255,255,255,0.78)' }}>
                    {comprehension.description}
                  </p>
                </div>
              ) : null}

              {suggestions.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'rgba(176,141,87,0.7)' }}>
                    Suggestions
                  </p>
                  {suggestions.map((s) => (
                    <div key={s.key} style={{ padding: '7px 9px', borderRadius: 9, border: '1px solid rgba(176,141,87,0.22)', background: 'rgba(176,141,87,0.07)' }}>
                      <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.4, color: 'rgba(255,255,255,0.85)' }}>{s.label}</p>
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <button
                          type="button"
                          disabled={Boolean(busy)}
                          onClick={() => safeRun(() => ai.runSuggestion(s))}
                          style={{
                            flex: 1,
                            padding: '4px 8px',
                            borderRadius: 7,
                            border: '1px solid rgba(176,141,87,0.45)',
                            cursor: busy ? 'default' : 'pointer',
                            background: 'rgba(176,141,87,0.18)',
                            color: '#f3ead6',
                            fontSize: 11,
                            fontWeight: 700,
                            opacity: busy ? 0.5 : 1,
                          }}
                        >
                          Appliquer
                        </button>
                        <button
                          type="button"
                          onClick={() => safeDismiss(s.key)}
                          style={{
                            padding: '4px 9px',
                            borderRadius: 7,
                            border: '1px solid rgba(255,255,255,0.12)',
                            cursor: 'pointer',
                            background: 'transparent',
                            color: '#9ca3af',
                            fontSize: 11,
                          }}
                        >
                          Ignorer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <p style={{ margin: 0, fontSize: 9, lineHeight: 1.4, color: '#6b7280' }}>
                Écrivez ou dessinez sur le tableau, puis lancez une action : lecture, mise au propre, présentation ou illustration.
              </p>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 11, lineHeight: 1.45, color: '#9ca3af' }}>
              Activez le copilote pour lire le tableau et le transformer (mise au propre, présentation, illustration).
            </p>
          )}
        </div>
      ) : null}

      {/* Keyframes locales pour le spinner (évite toute dépendance CSS externe). */}
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );
}

// ── Petit bouton segmenté (palier de coût) ───────────────────────────────────
function SegBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        flex: 1,
        padding: '5px 8px',
        borderRadius: 7,
        border: 'none',
        cursor: 'pointer',
        fontSize: 11,
        fontWeight: 700,
        background: active ? 'rgba(176,141,87,0.22)' : 'transparent',
        color: active ? '#f3ead6' : '#9ca3af',
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      {label}
    </button>
  );
}
