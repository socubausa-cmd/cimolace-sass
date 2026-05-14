import { labelLivePermissionAction } from '@/lib/liriLive/permissionRequestSignals';
import { normalizeJoyKitLevel } from '@/lib/liriLive/joykitRequestSignals';
import { longiaPanelEventMatchesFilter, LONGIA_PANEL_FILTER } from '@/lib/longiaLiveCopilot';

/**
 * Valeurs dérivées pour les aperçus de panneaux signal hôte : journal filtré,
 * derniers événements, compteurs NeuronQ, lignes de prévisualisation Mesh / JoyKit.
 */
export function useLiveHostSignalPanelPreviews({
  panels,
  hostNotifFilter,
  debateNeuronqEnabled,
  neuronqQuestions,
  meshRequests,
  hostPermissionRequests,
  hostJoyKitRequests,
  activeEtapes,
  step,
}) {
  const journalVisiblePreview =
    hostNotifFilter !== LONGIA_PANEL_FILTER.ALL
      ? panels[2].events.filter((ev) => longiaPanelEventMatchesFilter(ev, hostNotifFilter))
      : panels[2].events;
  const lastJournalPreviewEv =
    journalVisiblePreview.length > 0 ? journalVisiblePreview[journalVisiblePreview.length - 1] : null;
  const lastHandEv = panels[0].events.length ? panels[0].events[panels[0].events.length - 1] : null;
  const nqPendingN = debateNeuronqEnabled ? neuronqQuestions.filter((q) => q.status !== 'answered').length : 0;
  const nqFirstQ = debateNeuronqEnabled ? neuronqQuestions.find((q) => q.status !== 'answered') || neuronqQuestions[0] : null;
  const meshPreviewLine =
    meshRequests.length > 0
      ? `Demande : ${String(meshRequests[meshRequests.length - 1]?.name || 'Participant').slice(0, 40)}`
      : 'Aucune demande Control Mesh';
  const lastPermReq = hostPermissionRequests.length ? hostPermissionRequests[hostPermissionRequests.length - 1] : null;
  const lastJoyReq = hostJoyKitRequests.length ? hostJoyKitRequests[hostJoyKitRequests.length - 1] : null;
  const permReqPreviewLine = (() => {
    const parts = [];
    if (lastPermReq) parts.push(`${lastPermReq.name} · ${labelLivePermissionAction(lastPermReq.action)}`);
    if (lastJoyReq) parts.push(`${lastJoyReq.name} · JoyKit (${normalizeJoyKitLevel(lastJoyReq.requestedLevel)})`);
    return parts.length ? parts.join(' — ') : 'Aucune demande d’accès / JoyKit';
  })();
  const hostAccessRequestCount = hostPermissionRequests.length + hostJoyKitRequests.length;
  const curEtape = activeEtapes[step] || activeEtapes[0] || {};

  return {
    journalVisiblePreview,
    lastJournalPreviewEv,
    lastHandEv,
    nqPendingN,
    nqFirstQ,
    meshPreviewLine,
    lastPermReq,
    lastJoyReq,
    permReqPreviewLine,
    hostAccessRequestCount,
    curEtape,
  };
}
