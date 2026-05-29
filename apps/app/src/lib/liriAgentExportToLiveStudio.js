/**
 * Pont Agent LIRI → constructeur live (/studio/live) : texte pour SmartBoard Architect.
 */

export const LIRI_AGENT_PENDING_LIVE_KEY = 'liri_agent_pending_for_live_studio_v1';

/** Réponse `smartboard-ia-generate` à ouvrir en aperçu Architect (étape 6) après navigation depuis l'Agent LIRI. */
export const LIRI_AGENT_ARCHITECT_PENDING_KEY = 'liri_agent_architect_pending_v1';
/** Masterclass Factory → Studio live (texte + artefacts coach). */
export const LIRI_MASTERCLASS_PENDING_LIVE_KEY = 'liri_masterclass_pending_for_live_studio_v1';

/**
 * @param {Record<string, unknown>} apiData — réponse brute `smartboard-ia-generate` (slides, …)
 */
export function savePendingArchitectForLiveStudio(apiData) {
  try {
    localStorage.setItem(
      LIRI_AGENT_ARCHITECT_PENDING_KEY,
      JSON.stringify({
        v: 1,
        apiData,
        savedAt: new Date().toISOString(),
      }),
    );
  } catch (e) {
    console.warn('[liriAgentExportToLiveStudio] architect save failed', e);
  }
}

/**
 * @returns {Record<string, unknown> | null}
 */
export function consumePendingArchitectForLiveStudio() {
  try {
    const raw = localStorage.getItem(LIRI_AGENT_ARCHITECT_PENDING_KEY);
    if (!raw) return null;
    localStorage.removeItem(LIRI_AGENT_ARCHITECT_PENDING_KEY);
    const data = JSON.parse(raw);
    const api = data?.apiData;
    if (!api || typeof api !== 'object') return null;
    const slides = api.slides;
    if (!Array.isArray(slides) || slides.length < 1) return null;
    return api;
  } catch {
    try {
      localStorage.removeItem(LIRI_AGENT_ARCHITECT_PENDING_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

/**
 * Aplatit le JSON cours LIRI en texte structuré pour `smartboard-ia-generate` / zone « Coller un cours ».
 * @param {Record<string, unknown>} cours
 * @returns {string}
 */
export function buildLiriCourseTextForLiveStudio(cours) {
  if (!cours || typeof cours !== 'object') return '';
  const lines = [];
  lines.push(`# ${String(cours.titre || 'Cours LIRI').trim()}`);
  if (cours.sous_titre) lines.push(`*${String(cours.sous_titre)}*`);
  if (cours.objectif) lines.push(`\n**Objectif :** ${String(cours.objectif)}`);
  if (cours.duree_estimee) lines.push(`**Durée estimée :** ${String(cours.duree_estimee)}`);
  lines.push('');
  const etapes = Array.isArray(cours.etapes) ? cours.etapes : [];
  etapes.forEach((e, i) => {
    const sb = e?.smartboard || {};
    const ms = e?.masterscript || {};
    const num = e?.numero ?? i + 1;
    lines.push(`## Étape ${num} — ${String(sb.titre || `Étape ${num}`)} (${String(e?.tag || '')})`);
    if (sb.idee) lines.push(`*${String(sb.idee)}*`);
    if (sb.contenu) lines.push(String(sb.contenu));
    if (sb.support_visuel) lines.push(`**Support visuel :** ${String(sb.support_visuel)}`);
    if (sb.question_cle) lines.push(`**Question clé :** ${String(sb.question_cle)}`);
    lines.push('');
    lines.push('### MasterScript (professeur)');
    if (ms.intention) lines.push(`**Intention :** ${String(ms.intention)}`);
    if (ms.script) lines.push(String(ms.script));
    if (Array.isArray(ms.questions) && ms.questions.length) {
      lines.push(`**Questions :** ${ms.questions.map((q) => String(q)).join(' · ')}`);
    }
    if (Array.isArray(ms.reponses_attendues) && ms.reponses_attendues.length) {
      lines.push(`**Réponses attendues :** ${ms.reponses_attendues.map((q) => String(q)).join(' · ')}`);
    }
    if (Array.isArray(ms.pieges_erreurs) && ms.pieges_erreurs.length) {
      lines.push(`**Pièges :** ${ms.pieges_erreurs.map((q) => String(q)).join(' · ')}`);
    }
    if (ms.transition) lines.push(`**Transition :** ${String(ms.transition)}`);
    lines.push('');
  });
  if (cours.adage_final) lines.push(`## Adage final\n${String(cours.adage_final)}`);
  if (cours.loi_doctrinale) lines.push(`**Loi doctrinale :** ${String(cours.loi_doctrinale)}`);
  if (cours.conseil_prof) lines.push(`**Conseil du maître :** ${String(cours.conseil_prof)}`);
  return lines.join('\n').trim();
}

/**
 * @param {Record<string, unknown>} cours
 */
export function savePendingLiriCourseForLiveStudio(cours) {
  const text = buildLiriCourseTextForLiveStudio(cours);
  const title = String(cours?.titre || '').trim() || 'Cours LIRI';
  try {
    localStorage.setItem(
      LIRI_AGENT_PENDING_LIVE_KEY,
      JSON.stringify({
        v: 1,
        title,
        text,
        savedAt: new Date().toISOString(),
      }),
    );
  } catch (e) {
    console.warn('[liriAgentExportToLiveStudio] save failed', e);
  }
}

/**
 * @returns {{ title: string, text: string } | null}
 */
export function consumePendingLiriCourseForLiveStudio() {
  try {
    const raw = localStorage.getItem(LIRI_AGENT_PENDING_LIVE_KEY);
    if (!raw) return null;
    localStorage.removeItem(LIRI_AGENT_PENDING_LIVE_KEY);
    const data = JSON.parse(raw);
    if (!data?.text || typeof data.text !== 'string') return null;
    return {
      title: String(data.title || 'Cours LIRI').trim(),
      text: data.text,
    };
  } catch {
    return null;
  }
}

/**
 * @param {{ title?: string, text?: string, masterclass?: Record<string, unknown> }} payload
 */
export function savePendingMasterclassForLiveStudio(payload) {
  const title = String(payload?.title || 'Masterclass LIRI').trim();
  const text = String(payload?.text || '').trim();
  const masterclass = payload?.masterclass && typeof payload.masterclass === 'object' ? payload.masterclass : null;
  if (!text) return;
  try {
    localStorage.setItem(
      LIRI_MASTERCLASS_PENDING_LIVE_KEY,
      JSON.stringify({
        v: 1,
        title,
        text,
        masterclass,
        savedAt: new Date().toISOString(),
      }),
    );
  } catch (e) {
    console.warn('[liriAgentExportToLiveStudio] save masterclass failed', e);
  }
}

/**
 * @returns {{ title: string, text: string, masterclass: Record<string, unknown> | null } | null}
 */
export function consumePendingMasterclassForLiveStudio() {
  try {
    const raw = localStorage.getItem(LIRI_MASTERCLASS_PENDING_LIVE_KEY);
    if (!raw) return null;
    localStorage.removeItem(LIRI_MASTERCLASS_PENDING_LIVE_KEY);
    const data = JSON.parse(raw);
    if (!data?.text || typeof data.text !== 'string') return null;
    return {
      title: String(data.title || 'Masterclass LIRI').trim(),
      text: data.text,
      masterclass: data?.masterclass && typeof data.masterclass === 'object' ? data.masterclass : null,
    };
  } catch {
    return null;
  }
}
