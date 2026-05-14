import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveWhiteboardStore } from '@/components/live-room/useLiveWhiteboardStore';
import { supabase } from '@/lib/customSupabaseClient';
import { getSupabaseFunctionErrorMessage } from '@/lib/supabaseEdgeInvoke';

const DEBOUNCE_FIX_MS = 550;
const DEBOUNCE_INFORM_MS = 2200;
const MIN_CHARS = 8;
const MAX_ITEMS = 40;
const REQ_COOLDOWN_MS = 900;

function looksScienceOrFormula(s) {
  const t = String(s || '');
  return (
    /[=^]/.test(t)
    || /\b(m\/s|km\/h|mol|Pa|J|N|W|V|Ω|π|sigma|delta|alpha|beta|gamma|H2O|CO2|E=|mc\^?2|Einstein|Newton|force|atome|molécule|équation|réaction|cellule|ADN)\b/i.test(t)
    || t.length > 55
  );
}

function lastSentenceOrBlock(text) {
  const t = String(text || '').trimEnd();
  if (!t) return '';
  const parts = t.split(/(?<=[.!?])\s+/);
  const last = parts[parts.length - 1] || t;
  return last.slice(-800);
}

function fullBlockForFix(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  const paras = t.split(/\n\s*\n/);
  const block = paras[paras.length - 1] || t;
  return block.slice(0, 1800);
}

let idSeq = 0;
function nextId() {
  idSeq += 1;
  return `lia-${Date.now()}-${idSeq}`;
}

/**
 * Fil passif pour le rail gauche : écoute le brouillon texte SmartBoard (store) et
 * enrichit avec `reformulate-text` (fix / inform) sans interaction utilisateur.
 */
export function useLiriLivePassiveAssistantFeed() {
  const boardTextDraftPreview = useLiveWhiteboardStore((s) => s.boardTextDraftPreview);
  const boardTextDraftActive = useLiveWhiteboardStore((s) => s.boardTextDraftActive);
  const tool = useLiveWhiteboardStore((s) => s.tool);

  const [items, setItems] = useState(() => []);
  const [busy, setBusy] = useState(false);
  const lastFixInputRef = useRef('');
  const lastInformHashRef = useRef('');
  const lastFixReqAt = useRef(0);
  const lastInformReqAt = useRef(0);
  const fixTimer = useRef(null);
  const informTimer = useRef(null);
  const fixGen = useRef(0);
  const informGen = useRef(0);

  const pushItem = useCallback((entry) => {
    setItems((prev) => {
      const next = [
        {
          id: nextId(),
          at: Date.now(),
          ...entry,
        },
        ...prev,
      ];
      return next.slice(0, MAX_ITEMS);
    });
  }, []);

  const runFix = useCallback(
    async (raw) => {
      const text = fullBlockForFix(raw).trim();
      if (text.length < MIN_CHARS) return;
      if (text === lastFixInputRef.current) return;
      const now = Date.now();
      if (now - lastFixReqAt.current < REQ_COOLDOWN_MS) return;
      lastFixReqAt.current = now;
      const my = ++fixGen.current;
      setBusy(true);
      try {
        const { data, error: fnError } = await supabase.functions.invoke('reformulate-text', {
          body: { text, context: 'description', boardMode: 'fix' },
        });
        if (my !== fixGen.current) return;
        if (fnError) {
          const msg = await getSupabaseFunctionErrorMessage(fnError);
          pushItem({ kind: 'erreur', titre: 'Correction', corps: msg });
          return;
        }
        const result = data?.result != null ? String(data.result).trim() : '';
        if (!result || result === text) {
          lastFixInputRef.current = text;
          return;
        }
        lastFixInputRef.current = text;
        pushItem({
          kind: 'correction',
          titre: 'Phrase sans faute (proposition)',
          source: lastSentenceOrBlock(text).slice(0, 220),
          corps: result,
          provider: data?.provider || null,
        });
      } catch (e) {
        if (my === fixGen.current) {
          pushItem({ kind: 'erreur', titre: 'IA', corps: e?.message || 'Erreur' });
        }
      } finally {
        if (my === fixGen.current) setBusy(false);
      }
    },
    [pushItem],
  );

  const runInform = useCallback(
    async (raw) => {
      const text = String(raw || '').trim();
      if (text.length < 24 || !looksScienceOrFormula(text)) return;
      const h = `${text.slice(0, 120)}`;
    if (h === lastInformHashRef.current) return;
    const now = Date.now();
    if (now - lastInformReqAt.current < REQ_COOLDOWN_MS) return;
    lastInformReqAt.current = now;
      const my = ++informGen.current;
      setBusy(true);
      try {
        const { data, error: fnError } = await supabase.functions.invoke('reformulate-text', {
          body: { text: text.slice(0, 1600), context: 'description', boardMode: 'inform' },
        });
        if (my !== informGen.current) return;
        if (fnError) return;
        const result = data?.result != null ? String(data.result).trim() : '';
        if (!result || result.length < 12) return;
        lastInformHashRef.current = h;
        pushItem({
          kind: 'enrichissement',
          titre: 'Repère & formulation (sciences / contenu)',
          corps: result,
          provider: data?.provider || null,
        });
      } catch {
        /* ignore */
      } finally {
        if (my === informGen.current) setBusy(false);
      }
    },
    [pushItem],
  );

  useEffect(() => {
    const raw = boardTextDraftPreview;
    if (fixTimer.current) clearTimeout(fixTimer.current);
    if (informTimer.current) clearTimeout(informTimer.current);

    if (!boardTextDraftActive || !String(raw || '').trim()) {
      return undefined;
    }

    fixTimer.current = setTimeout(() => {
      void runFix(raw);
    }, DEBOUNCE_FIX_MS);

    informTimer.current = setTimeout(() => {
      void runInform(raw);
    }, DEBOUNCE_INFORM_MS);

    return () => {
      if (fixTimer.current) clearTimeout(fixTimer.current);
      if (informTimer.current) clearTimeout(informTimer.current);
    };
  }, [boardTextDraftPreview, boardTextDraftActive, runFix, runInform]);

  return {
    items,
    busy,
    boardTextDraftActive,
    tool,
    previewLen: String(boardTextDraftPreview || '').length,
  };
}
