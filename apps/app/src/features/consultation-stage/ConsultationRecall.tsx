// ─────────────────────────────────────────────────────────────────────────────
// RÉCAP « NEURONE » — Longia RecallProducer (salle de téléconsultation MEDOS).
//
// Panneau autonome (drawer à droite, façon appel vidéo) que le PRATICIEN ouvre
// en fin de consultation pour générer un mémo post-session : synthèse + notes +
// points de suivi. S'appuie sur le mode gouverneur LONGIA « recallProducer »
// (cf. lib/longiaLiveCopilot — LONGIA_GOVERNOR_MODE.RECALL_PRODUCER), exécuté via
// le hub LONGIA (invokeLongiaHub → studio-longia-chat).
//
// IMPORTANT — sur le mapping des « modes » :
//   • Le mode RECALL réel est un mode GOUVERNEUR : 'recallProducer'. Il ne vit
//     PAS dans le param `mode` de invokeLongiaHub (qui n'accepte que
//     'coach' | 'architect') mais dans le contexte + l'enveloppe `longia_hub`.
//   • On passe donc `mode: 'architect'` (synthèse lourde = bon fit transport)
//     ET on transporte le mode gouverneur 'recallProducer' via `context` +
//     `longiaHub.features.governorMode`, pour que l'Edge sache que c'est un Recall.
//
// Self-contained : aucun couplage au state de ConsultationRoom hormis `sessionId`.
// Styles inline + palette alignés sur ConsultationRoom (fond sombre, GOLD).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react';
import { Brain, X, Sparkles, RefreshCw, Copy, Check, AlertTriangle, ClipboardList } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
// API LONGIA réelle (modules .js du repo — typés `any` sous bundler/strict:false).
import { invokeLongiaHub } from '@/lib/longiaHub/client';
import { buildLongiaHubV1, LONGIA_SURFACE, LONGIA_ENGINE_ROLE } from '@/lib/longiaHub/schema';
import { LONGIA_GOVERNOR_MODE, LONGIA_GOVERNOR_MODE_LABELS } from '@/lib/longiaLiveCopilot';

// ── Palette (alignée ConsultationRoom.tsx) ───────────────────────────────────
const GOLD = '#b08d57';
const PANEL_BG = 'rgba(18,18,20,0.98)';

// Mode gouverneur RECALL réel ('recallProducer') + son libellé FR ('Recall / post-live').
const RECALL_MODE: string = LONGIA_GOVERNOR_MODE.RECALL_PRODUCER;
const RECALL_LABEL: string =
  (LONGIA_GOVERNOR_MODE_LABELS && LONGIA_GOVERNOR_MODE_LABELS[RECALL_MODE]) || 'Recall / post-live';

// Forme (souple) de la réponse du hub LONGIA — voir JSDoc de invokeStudioLongiaChat :
// le texte affichable est sur `text` (fallbacks `unified.message` / `message`).
type LongiaResult = {
  text?: string;
  message?: string;
  unified?: { message?: string } | null;
  suggestions?: Array<{ label?: string }> | null;
} | null;

function extractRecallText(res: LongiaResult): string {
  if (!res || typeof res !== 'object') return '';
  if (typeof res.text === 'string' && res.text.trim()) return res.text.trim();
  if (res.unified && typeof res.unified.message === 'string' && res.unified.message.trim()) {
    return res.unified.message.trim();
  }
  if (typeof res.message === 'string' && res.message.trim()) return res.message.trim();
  return '';
}

// Invite (1 message user MINIMUM — invokeLongiaHub jette si `messages` est vide).
function buildRecallMessages(patientName?: string | null): Array<{ role: 'user'; content: string }> {
  const who = patientName ? ` avec ${patientName}` : '';
  return [
    {
      role: 'user',
      content:
        `Tu es Longia en mode « ${RECALL_LABEL} » (recallProducer). Produis le RÉCAP post-consultation` +
        `${who} (santé / wellness fonctionnel), en français, structuré et concis :\n` +
        `1. Synthèse de la séance (motif, échanges clés).\n` +
        `2. Observations cliniques notables.\n` +
        `3. Plan & recommandations (hygiène de vie, examens, ordonnance le cas échéant).\n` +
        `4. Points de suivi pour le prochain rendez-vous.\n` +
        `Pas de diagnostic affirmatif non étayé ; reste factuel et actionnable.`,
    },
  ];
}

export interface ConsultationRecallProps {
  /** Identifiant de la session de téléconsultation (route /teleconsult/:sessionId). */
  sessionId: string;
  /** Nom du patient (facultatif) — enrichit le contexte du récap. */
  patientName?: string | null;
  /** Fermer le panneau (rendu en drawer dans ConsultationRoom). */
  onClose?: () => void;
}

/**
 * Panneau RÉCAP « neurone » (Longia RecallProducer).
 * Bouton « Générer le récap » → invokeLongiaHub(...) → affiche la synthèse.
 * Gère loading / erreur / vide de façon gracieuse. Aucune dépendance externe
 * hormis `sessionId` (+ Supabase importé directement).
 */
export default function ConsultationRecall({ sessionId, patientName, onClose }: ConsultationRecallProps) {
  const [loading, setLoading] = useState(false);
  const [recall, setRecall] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Évite un setState après démontage (la requête hub peut être longue).
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const generate = useCallback(async () => {
    if (!sessionId) {
      setError('Session introuvable : impossible de générer le récap.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Enveloppe LONGIA Hub : on déclare la surface + le mode gouverneur Recall
      // dans `features` pour que l'Edge route en RecallProducer.
      const longiaHub = buildLongiaHubV1({
        surface: LONGIA_SURFACE.UNKNOWN,
        mode: 'architect',
        engines: [LONGIA_ENGINE_ROLE.EVENTS],
        features: {
          governorMode: RECALL_MODE, // 'recallProducer' — le mode RECALL réel.
          context: 'medos_teleconsult',
          sessionId,
        },
      });

      const res: LongiaResult = await invokeLongiaHub(supabase, {
        // `mode` API = 'architect' (synthèse lourde) ; le mode RECALL voyage dans
        // le contexte + l'enveloppe ci-dessus.
        mode: 'architect',
        messages: buildRecallMessages(patientName),
        context: {
          sessionId,
          governorMode: RECALL_MODE,
          surface: 'medos_teleconsult',
          ...(patientName ? { patientName } : {}),
        },
        longiaHub,
      });

      if (!aliveRef.current) return;
      const text = extractRecallText(res);
      if (!text) {
        setError("Longia n'a renvoyé aucun récap exploitable. Réessayez dans un instant.");
        return;
      }
      setRecall(text);
    } catch (e: any) {
      if (!aliveRef.current) return;
      setError(e?.message ? String(e.message) : 'Génération du récap impossible.');
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [sessionId, patientName]);

  const copyRecall = useCallback(async () => {
    if (!recall) return;
    try {
      await navigator.clipboard.writeText(recall);
      setCopied(true);
      setTimeout(() => {
        if (aliveRef.current) setCopied(false);
      }, 2000);
    } catch {
      /* clipboard refusé — silencieux */
    }
  }, [recall]);

  return (
    <div
      style={{
        width: 360,
        flexShrink: 0,
        background: PANEL_BG,
        borderLeft: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      {/* En-tête */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <Brain size={16} color={GOLD} aria-hidden="true" />
        <span style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>Récap</span>
        <span
          style={{
            fontSize: 10.5,
            color: '#9ca3af',
            background: 'rgba(255,255,255,0.06)',
            padding: '2px 8px',
            borderRadius: 999,
            whiteSpace: 'nowrap',
          }}
        >
          {RECALL_LABEL}
        </span>
        {onClose ? (
          <button
            onClick={onClose}
            aria-label="Fermer le récap"
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              color: '#9ca3af',
              cursor: 'pointer',
              display: 'inline-flex',
            }}
          >
            <X size={16} />
          </button>
        ) : null}
      </div>

      {/* Corps */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Erreur (non bloquante) */}
        {error ? (
          <div
            style={{
              display: 'flex',
              gap: 9,
              alignItems: 'flex-start',
              padding: '10px 12px',
              borderRadius: 11,
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.28)',
            }}
          >
            <AlertTriangle size={16} color="#fca5a5" style={{ marginTop: 1, flexShrink: 0 }} aria-hidden="true" />
            <span style={{ fontSize: 12.5, color: '#fecaca', lineHeight: 1.5 }}>{error}</span>
          </div>
        ) : null}

        {/* État vide (jamais généré) */}
        {!recall && !loading ? (
          <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 270, color: '#9ca3af' }}>
            <ClipboardList size={30} color={GOLD} style={{ margin: '0 auto 12px', opacity: 0.85 }} aria-hidden="true" />
            <p style={{ fontSize: 13.5, fontWeight: 600, color: '#e5e7eb', margin: '0 0 6px' }}>
              Mémo post-consultation
            </p>
            <p style={{ fontSize: 12.5, lineHeight: 1.55, margin: 0 }}>
              Longia synthétise la séance : observations, plan et points de suivi. Générez le récap en fin de
              consultation.
            </p>
          </div>
        ) : null}

        {/* Chargement */}
        {loading ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: '#cbd5e1' }}>
            <Spinner />
            <p style={{ fontSize: 12.5, color: '#9ca3af', marginTop: 12 }}>Longia rédige le récap…</p>
          </div>
        ) : null}

        {/* Résultat */}
        {recall && !loading ? (
          <div
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: 13.5,
              lineHeight: 1.6,
              color: '#e5e7eb',
              background: 'rgba(255,255,255,0.035)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12,
              padding: 14,
            }}
          >
            {recall}
          </div>
        ) : null}
      </div>

      {/* Pied : actions */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: 12,
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <button
          onClick={generate}
          disabled={loading}
          style={{
            flex: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '11px 14px',
            borderRadius: 10,
            border: 'none',
            cursor: loading ? 'default' : 'pointer',
            background: GOLD,
            color: '#1a1a1a',
            fontSize: 13.5,
            fontWeight: 700,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {recall ? <RefreshCw size={16} aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
          {loading ? 'Génération…' : recall ? 'Régénérer le récap' : 'Générer le récap'}
        </button>
        {recall ? (
          <button
            onClick={copyRecall}
            aria-label="Copier le récap"
            title="Copier le récap"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.16)',
              cursor: 'pointer',
              background: 'rgba(255,255,255,0.06)',
              color: copied ? '#86efac' : '#cbd5e1',
            }}
          >
            {copied ? <Check size={17} /> : <Copy size={17} />}
          </button>
        ) : null}
      </div>
    </div>
  );
}

// Spinner minimal (keyframes injectées une fois — évite une dépendance CSS).
function Spinner() {
  return (
    <>
      <style>{'@keyframes liri-recall-spin{to{transform:rotate(360deg)}}'}</style>
      <span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: 26,
          height: 26,
          border: '3px solid rgba(176,141,87,0.25)',
          borderTopColor: GOLD,
          borderRadius: '50%',
          animation: 'liri-recall-spin 0.8s linear infinite',
        }}
      />
    </>
  );
}
