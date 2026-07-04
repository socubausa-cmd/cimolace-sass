// ─────────────────────────────────────────────────────────────────────────────
// ConsultationStudioPrep — « Préparer le studio » de la téléconsultation.
//
// Overlay PLEIN ÉCRAN qui monte l'éditeur SmartBoard Konva COMPLET
// (`SmartboardKonvaEditorV1`, le studio du mode Formation) pour que le praticien
// prépare ses supports AVANT/PENDANT la consultation : scènes, images, texte,
// schémas, présentations. C'est « le studio smartboard » demandé.
//
// AUTONOME : l'éditeur s'appuie sur des stores Zustand GLOBAUX (pas de Provider
// requis). On le charge en `React.lazy` (bundle lourd : Konva + coach IA) → tiré
// seulement à l'ouverture du studio.
//
// PERSISTANCE (v1) : le deck préparé est sauvegardé LOCALEMENT par session
// (`localStorage: liri:consult-studio:<id>`) via le bundle workspace officiel
// (`buildWorkspacePayloadFromStores`). Réouvrir le studio recharge le deck
// (`hydrateWorkspaceIntoKonvaEditor`). Un branchement cloud (table
// `course_workspaces`) pourra remplacer ces 2 accès sans toucher au reste.
//
// PRÉSENTATION au patient : hors périmètre de CE composant (le projet Konva n'a
// pas de voie native vers `displaySlides`). Le praticien montre son studio via le
// PARTAGE D'ÉCRAN (déjà supporté) ; une voie intégrée (export image → scène
// partagée cockpit) pourra suivre.
// ─────────────────────────────────────────────────────────────────────────────
import React, { Suspense, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Presentation, Loader2 } from 'lucide-react';
import {
  buildWorkspacePayloadFromStores,
  hydrateWorkspaceIntoKonvaEditor,
} from '@/features/smartboard-konva-editor/store/smartboardWorkspaceApi';

// Éditeur lourd (Konva + IA) → chargé à l'ouverture seulement.
const SmartboardKonvaEditorV1 = React.lazy(
  () => import('@/features/smartboard-konva-editor/SmartboardKonvaEditorV1'),
);

const BG = '#262624'; // shell chaud LIRI
const GOLD = '#d4a36a';
const STRIP = 'rgba(43,41,38,0.96)';

const keyFor = (sessionId: string) => `liri:consult-studio:${sessionId}`;

export default function ConsultationStudioPrep({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose: () => void;
}) {
  // Recharge le deck préparé pour cette session (s'il existe) au montage.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(keyFor(sessionId));
      if (raw) hydrateWorkspaceIntoKonvaEditor(JSON.parse(raw));
    } catch {
      /* pas de deck / payload invalide → on démarre sur un projet vierge */
    }
  }, [sessionId]);

  const persist = () => {
    try {
      const payload = buildWorkspacePayloadFromStores();
      localStorage.setItem(keyFor(sessionId), JSON.stringify(payload));
    } catch {
      /* quota / mode privé : on ne bloque pas la fermeture */
    }
  };

  const saveAndClose = () => {
    persist();
    onClose();
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483200, // au-dessus de la salle (portalée à 2147483000)
        background: BG,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Bandeau overlay minimal (titre + Terminer). L'éditeur garde son chrome. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 14px',
          background: STRIP,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}
      >
        <Presentation size={17} color={GOLD} aria-hidden="true" />
        <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>Préparer le studio</span>
        <span style={{ fontSize: 11.5, color: '#9ca3af' }}>
          Concevez vos supports (scènes, images, schémas) — sauvegardés pour cette consultation.
        </span>
        <button
          onClick={saveAndClose}
          title="Enregistrer et fermer le studio"
          style={{
            marginLeft: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 34,
            padding: '0 14px',
            borderRadius: 9,
            border: 'none',
            cursor: 'pointer',
            background: GOLD,
            color: '#1a1a1a',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          <Check size={15} aria-hidden="true" /> Terminer
        </button>
        <button
          onClick={onClose}
          title="Fermer sans enregistrer"
          aria-label="Fermer sans enregistrer"
          style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'inline-flex', padding: 4 }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Éditeur SmartBoard Konva plein cadre. */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <Suspense fallback={<StudioLoading />}>
          <SmartboardKonvaEditorV1 className="h-full w-full" />
        </Suspense>
      </div>
    </div>,
    document.body,
  );
}

function StudioLoading() {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: BG, color: '#9ca3af' }}>
      <div style={{ textAlign: 'center' }}>
        <Loader2 size={26} color={GOLD} className="animate-spin" style={{ margin: '0 auto 10px' }} aria-hidden="true" />
        <p style={{ fontSize: 13.5, fontWeight: 600 }}>Ouverture du studio…</p>
      </div>
    </div>
  );
}
