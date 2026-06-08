import { validateCoachArchitectHandoff } from './validateCoachArchitectHandoff.ts';

export type ParsedDesignerKonvaContext = {
  /** Contexte JSON affiché au modèle (sans drapeaux internes). */
  ctxForJson: Record<string, unknown>;
  designerKonvaAssist: boolean;
  langDesigner: string;
  handoffLine: string;
  handoffError: string | null;
};

/**
 * Extrait `designer_konva_assist`, `lang`, `coach_architect_handoff`, `useRag` du contexte client.
 * Valide le handoff comme `liri-smartboard-designer-chat`.
 */
export function parseDesignerKonvaRequestContext(
  ctx: Record<string, unknown>,
): ParsedDesignerKonvaContext {
  const out: Record<string, unknown> = { ...ctx };
  /** Métadonnée produit — ne pas injecter dans le prompt LLM (économie de jetons). */
  delete out.longia_hub;
  /** Signaux Events (payload potentiellement lourd) — réservé au routage / futur moteur Events. */
  delete out.longia_event_signal;
  const designerKonvaAssist = out.designer_konva_assist === true;
  delete out.designer_konva_assist;
  const langDesigner = String(out.lang ?? 'fr').trim() || 'fr';

  delete out.useRag;

  const rawHo = out.coach_architect_handoff;
  delete out.coach_architect_handoff;

  let handoffLine = '';
  let handoffError: string | null = null;
  if (rawHo != null) {
    const v = validateCoachArchitectHandoff(rawHo);
    if (!v.ok) handoffError = v.errors.join(' ');
    else {
      handoffLine = `\n\nPont Coach→Architect (JSON validé) :\n${JSON.stringify(v.value)}`;
    }
  }

  return {
    ctxForJson: out,
    designerKonvaAssist,
    langDesigner,
    handoffLine,
    handoffError,
  };
}
