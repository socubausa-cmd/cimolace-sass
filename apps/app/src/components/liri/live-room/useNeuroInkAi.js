/**
 * useNeuroInkAi — orchestration du copilote NeuroInk IA (hôte).
 *
 * Relie les quatre actions hôte aux briques IA existantes et au tableau :
 *  1. Comprendre   : rasterise le tableau → vision-describe → lecture affichée + suggestions.
 *  2. Mettre au propre : lecture → architect-structured → texte net appliqué au tableau.
 *  3. Présentation : lecture → architect-structured → cadres « diapo » appliqués au tableau.
 *  4. Illustration : concept → generate-visual-image → image posée sur le tableau.
 *
 * L'application au tableau réutilise l'event `LIRI_LIVE_ARCHITECT_APPLY` (déjà
 * écouté par SmartBoardCompositor) — aucune mutation directe du canvas ici.
 * L'état (busy / lecture / suggestions / erreur) vit dans le store whiteboard.
 */
import { useCallback } from 'react';
import { LIRI_LIVE_ARCHITECT_APPLY } from '@/lib/liriLiveArchitectApplyEvent';
import {
  aiVisionDescribe,
  aiArchitectStructured,
  aiGenerateImage,
  architectItemsToProposals,
  humanizeNeuroInkAiError,
} from '@/lib/neuroInkAi';
import { useLiveWhiteboardStore } from './useLiveWhiteboardStore';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function dispatchProposal(proposal) {
  if (typeof window === 'undefined' || !proposal) return;
  window.dispatchEvent(new CustomEvent(LIRI_LIVE_ARCHITECT_APPLY, { detail: proposal }));
}

/** Suggestions contextuelles dérivées d'une lecture (statique mais ciblé v1). */
function buildSuggestions() {
  return [
    { key: 'present', kind: 'present', label: 'Transformer en présentation', text: 'Structurer le tableau en diapo claire.' },
    { key: 'illustrate', kind: 'illustrate', label: 'Générer une illustration', text: 'Créer un visuel du concept détecté.' },
    { key: 'cleanup', kind: 'cleanup', label: 'Mettre au propre', text: 'Réécrire proprement le contenu manuscrit.' },
  ];
}

export function useNeuroInkAi({ lang = 'fr', sessionId } = {}) {
  const state = useLiveWhiteboardStore((s) => s.neuroInkAi);
  const setAi = useLiveWhiteboardStore((s) => s.setNeuroInkAi);

  const begin = useCallback((kind) => setAi({ busy: true, activeKind: kind, error: null }), [setAi]);
  const fail = useCallback((msg) => setAi({ busy: false, activeKind: null, error: msg }), [setAi]);
  const done = useCallback((patch = {}) => setAi({ busy: false, activeKind: null, error: null, ...patch }), [setAi]);

  /** Palier de coût courant : premium (Claude/OpenAI) si activé, sinon économie (DeepSeek/Mistral). */
  const tierNow = useCallback(
    () => (useLiveWhiteboardStore.getState().neuroInkAi.premium ? 'premium' : 'economy'),
    [],
  );

  /** Snapshot du tableau : image rasterisée + texte tapé + a-du-contenu. */
  const snapshot = useCallback(() => {
    const st = useLiveWhiteboardStore.getState();
    const img = st.aiRasterizeBoard?.() || null;
    const text = (st.aiReadBoardText?.() || '').trim();
    const has = text.length > 0 || (st.boardStrokeCount || 0) > 0;
    return { img, text, has };
  }, []);

  /**
   * Source texte pour structurer/réécrire le tableau :
   * 1) le texte tapé s'il est assez fourni (fidèle, sans vision),
   * 2) sinon une lecture vision récente réutilisée,
   * 3) sinon on rasterise et on lit le tableau via vision (cas manuscrit).
   */
  const getSourceText = useCallback(
    async (forceFresh = false) => {
      const { img, text, has } = snapshot();
      if (!has) return null;
      if (text && text.length >= 40 && !forceFresh) return text;
      const existing = useLiveWhiteboardStore.getState().neuroInkAi.comprehension?.description;
      if (existing && !forceFresh) return existing;
      if (img) {
        const { description, provider } = await aiVisionDescribe({ imageBase64: img, lang, centralIdea: text, tier: tierNow() });
        if (description) setAi({ comprehension: { description, provider, at: Date.now() } });
        return description || text || null;
      }
      return text || null;
    },
    [lang, snapshot, setAi, tierNow],
  );

  const comprehend = useCallback(async () => {
    const { img, text, has } = snapshot();
    if (!has || !img) {
      fail('Écris ou dessine d’abord sur le tableau.');
      return null;
    }
    begin('comprehend');
    try {
      const { description, provider } = await aiVisionDescribe({ imageBase64: img, lang, centralIdea: text, tier: tierNow() });
      if (!description) {
        fail('Lecture impossible — ajoute un peu de contenu et réessaie.');
        return null;
      }
      done({ comprehension: { description, provider, at: Date.now() }, suggestions: buildSuggestions() });
      return description;
    } catch (e) {
      fail(humanizeNeuroInkAiError(e));
      return null;
    }
  }, [snapshot, begin, fail, done, lang, tierNow]);

  const cleanup = useCallback(async () => {
    begin('cleanup');
    try {
      const source = await getSourceText();
      if (!source || source.length < 20) {
        fail('Pas assez de contenu lisible pour mettre au propre.');
        return false;
      }
      const { items } = await aiArchitectStructured({ assistantText: source, lang, tier: tierNow() });
      const proposals = architectItemsToProposals(items, { type: '', max: 2 });
      if (!proposals.length) {
        fail('L’IA n’a rien pu structurer à partir du tableau.');
        return false;
      }
      for (const p of proposals) {
        dispatchProposal(p);
        await sleep(220);
      }
      done();
      return true;
    } catch (e) {
      fail(humanizeNeuroInkAiError(e));
      return false;
    }
  }, [begin, fail, done, getSourceText, lang, tierNow]);

  const present = useCallback(async () => {
    begin('present');
    try {
      const source = await getSourceText();
      if (!source || source.length < 20) {
        fail('Pas assez de contenu pour bâtir une présentation.');
        return false;
      }
      const { items } = await aiArchitectStructured({ assistantText: source, lang, tier: tierNow() });
      const proposals = architectItemsToProposals(items, { type: 'layout', max: 5 });
      if (!proposals.length) {
        fail('L’IA n’a pas pu composer de présentation.');
        return false;
      }
      for (const p of proposals) {
        dispatchProposal(p);
        await sleep(240);
      }
      done();
      return true;
    } catch (e) {
      fail(humanizeNeuroInkAiError(e));
      return false;
    }
  }, [begin, fail, done, getSourceText, lang, tierNow]);

  const illustrate = useCallback(
    async (promptOverride) => {
      begin('illustrate');
      try {
        let prompt = String(promptOverride || '').trim();
        if (!prompt) {
          const source = await getSourceText();
          prompt = (source || '').slice(0, 300);
        }
        if (!prompt) {
          fail('Écris le concept à illustrer sur le tableau.');
          return false;
        }
        const { imageUrl } = await aiGenerateImage({ prompt, tier: tierNow() });
        if (!imageUrl) {
          fail('Génération d’image indisponible — réessaie.');
          return false;
        }
        dispatchProposal({ type: 'image_idea', imageUrl, title: 'Illustration', detail: prompt.slice(0, 120) });
        done();
        return true;
      } catch (e) {
        fail(humanizeNeuroInkAiError(e));
        return false;
      }
    },
    [begin, fail, done, getSourceText, tierNow],
  );

  const runSuggestion = useCallback(
    async (s) => {
      if (!s) return;
      if (s.kind === 'present') return present();
      if (s.kind === 'illustrate') return illustrate();
      if (s.kind === 'cleanup') return cleanup();
      return undefined;
    },
    [present, illustrate, cleanup],
  );

  const dismissSuggestion = useCallback(
    (key) => setAi((prev) => ({ ...prev, suggestions: (prev.suggestions || []).filter((s) => s.key !== key) })),
    [setAi],
  );

  const setEnabled = useCallback((v) => setAi({ enabled: !!v }), [setAi]);
  const setPremium = useCallback((v) => setAi({ premium: !!v }), [setAi]);
  const clearError = useCallback(() => setAi({ error: null }), [setAi]);

  return {
    state,
    comprehend,
    cleanup,
    present,
    illustrate,
    runSuggestion,
    dismissSuggestion,
    setEnabled,
    setPremium,
    clearError,
  };
}
