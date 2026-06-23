/**
 * Normalise une ligne live_scenes (ou brouillon wizard) vers le format SlideParallaxStage.
 */

import { getActiveTenantBranding } from '@/lib/tenant/activeBranding';

/** Badge « <tenant> · LIRI » résolu au runtime (tenant courant ; neutre LIRI hors tenant). */
const liveSceneBadgeLabel = () => `${getActiveTenantBranding().name} · LIRI`;

/** Visionneuse plein cadre SmartBoard : PDF natif, PowerPoint via Office Online (URL publique HTTPS requise). */
export function getDocumentEmbedSrc(url, documentKind) {
  if (!url) return '';
  if (documentKind === 'office') {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
  }
  return url;
}

/** Déduit le type de diapo importée (rétrocompat : anciennes entrées { url, label } seulement). */
export function inferUploadedSlideKind(entry) {
  if (entry?.kind === 'pdf' || entry?.kind === 'office' || entry?.kind === 'image') return entry.kind;
  const mime = String(entry?.mimeType || '').toLowerCase();
  if (mime === 'application/pdf') return 'pdf';
  if (
    mime === 'application/vnd.ms-powerpoint'
    || mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    || mime.includes('powerpoint')
    || mime.includes('presentation')
  ) {
    return 'office';
  }
  const name = String(entry?.label || '').toLowerCase();
  if (name.endsWith('.pdf')) return 'pdf';
  if (/\.(pptx|ppt|potx|ppsx|pps)$/.test(name)) return 'office';
  const u = String(entry?.url || '').toLowerCase();
  if (/\.pdf(\?|#|$)/.test(u)) return 'pdf';
  if (/\.(pptx|ppt)(\?|#|$)/i.test(u)) return 'office';
  return 'image';
}

/** Diapos importées (`config.smartboard_slides` : { url, label, kind?, mimeType? }[]) */
export function buildLiveScenesFromUploadedSlides(uploaded) {
  if (!Array.isArray(uploaded) || uploaded.length === 0) return [];
  return uploaded.map((s, i) => {
    const kind = inferUploadedSlideKind(s);
    const label = s.label || `Diapo ${i + 1}`;
    if (kind === 'pdf' || kind === 'office') {
      return {
        id: `smartboard-upload-${i}-${String(s.url || '').slice(-24)}`,
        name: label,
        order_index: 10_000 + i,
        content_payload_json: {
          elements: [
            {
              id: `u-${i}-doc`,
              type: 'document',
              src: s.url,
              documentKind: kind === 'office' ? 'office' : 'pdf',
              content: label,
              x: 0,
              y: 0,
              width: 860,
              height: 750,
              zIndex: 2,
            },
          ],
        },
      };
    }
    return {
      id: `smartboard-upload-${i}-${String(s.url || '').slice(-24)}`,
      name: label,
      order_index: 10_000 + i,
      content_payload_json: {
        elements: [
          { id: `u-${i}-badge`, type: 'badge', content: liveSceneBadgeLabel(), x: 44, y: 32, width: 360, height: 26, zIndex: 2 },
          { id: `u-${i}-title`, type: 'title', content: label, x: 44, y: 72, width: 772, height: 72, zIndex: 3 },
          { id: `u-${i}-img`, type: 'image', src: s.url, content: s.label || '', x: 44, y: 150, width: 772, height: 520, zIndex: 2 },
        ],
      },
    };
  });
}

export function parsePayload(raw) {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? raw : {};
}

function normalizeImageElement(el) {
  if (!el || el.type !== 'image') return el;
  const src = el.src || el.url || el.href;
  if (!src) return el;
  return { ...el, src };
}

function normalizeDocumentElement(el) {
  if (!el || el.type !== 'document') return el;
  const src = el.src || el.url || el.href;
  if (!src) return el;
  let documentKind = el.documentKind;
  if (documentKind !== 'office' && documentKind !== 'pdf') {
    const low = src.toLowerCase();
    documentKind = /\.(pptx|ppt)(\?|#|$)/i.test(low) ? 'office' : 'pdf';
  }
  return { ...el, src, documentKind };
}

function normalizeElements(els) {
  if (!Array.isArray(els)) return els;
  return els.map((el) => normalizeDocumentElement(normalizeImageElement(el)));
}

function pickImmersiveEdgeFeatherExtras(scene, payload, slideContent, iaRaw) {
  const raw = scene?.immersive_edge_feather
    ?? payload?.immersive_edge_feather
    ?? slideContent?.immersive_edge_feather
    ?? (iaRaw && typeof iaRaw === 'object' ? iaRaw.immersive_edge_feather : undefined);
  if (raw === undefined || raw === null || raw === '') return {};
  const n = Number(raw);
  if (!Number.isFinite(n)) return {};
  return { immersive_edge_feather: Math.min(100, Math.max(0, n)) };
}

export function normalizeLiveSceneToSlide(scene) {
  if (!scene) return null;
  const id = scene.id || scene.scene_id || `slide-${scene.order_index ?? 0}`;
  const payload = parsePayload(scene.content_payload_json);
  const slideContent = payload.slide_content_json;

  // Brouillon wizard / réponse IA : ia_data à la racine (pas dans content_payload_json)
  const iaRaw = scene.ia_data ?? payload.ia_data;
  const fe = pickImmersiveEdgeFeatherExtras(scene, payload, slideContent, iaRaw);
  // Propage is_active (le spread `...fe` est présent dans toutes les branches de retour) →
  // permet l'auto-projection de la scène active à l'ouverture de l'arène (issue #3).
  if (scene?.is_active === true) fe.is_active = true;

  if (iaRaw && typeof iaRaw === 'object' && (iaRaw.title || iaRaw.subtitle || iaRaw.core_idea || (iaRaw.development && iaRaw.development.length))) {
    return {
      id,
      title: scene.name || iaRaw.title || payload.title || 'Slide',
      ia_data: iaRaw,
      ...fe,
    };
  }

  // Éléments positionnels à la racine (smartboard_element_scenes sauvegardés dans config)
  if (Array.isArray(scene.elements) && scene.elements.length > 0) {
    return { id, title: scene.name || payload.title, elements: normalizeElements(scene.elements), ...fe };
  }

  if (Array.isArray(payload.elements) && payload.elements.length > 0) {
    return { id, title: scene.name || payload.title, elements: normalizeElements(payload.elements), ...fe };
  }

  if (slideContent?.elements?.length) {
    return { id, title: slideContent.title || scene.name, elements: normalizeElements(slideContent.elements), ...fe };
  }

  // Image plein cadre (préparation / imports légers)
  const imgUrl = payload.image_url || payload.slide_image_url || payload.media_url;
  if (imgUrl) {
    const title = scene.name || payload.title || 'Visuel';
    return {
      id,
      title,
      elements: normalizeElements([
        { id: `${id}-badge`, type: 'badge', content: liveSceneBadgeLabel(), x: 44, y: 32, width: 360, height: 26, zIndex: 2 },
        { id: `${id}-title`, type: 'title', content: title, x: 44, y: 72, width: 772, height: 72, zIndex: 3 },
        { id: `${id}-img`, type: 'image', src: imgUrl, content: payload.caption || '', x: 44, y: 150, width: 772, height: 520, zIndex: 2 },
      ]),
      ...fe,
    };
  }

  const title = scene.name || payload.title || 'Scène';
  const body = payload.notes || payload.summary_text || payload.reformulation_text || 'Contenu pédagogique à développer pendant le live.';
  // Coordonnées adaptées au canvas réel 860×750px (ratio ~1.15:1, paysage carré)
  // Zone utile 772×706px — marges 44px gauche/droite
  return {
    id,
    title,
    elements: [
      { id: `${id}-badge`, type: 'badge',     content: liveSceneBadgeLabel(),                                            x: 44, y: 32,  width: 360, height: 26,  zIndex: 2, animation: 'fade' },
      { id: `${id}-title`, type: 'title',     content: title,                                                            x: 44, y: 80,  width: 772, height: 100, zIndex: 3, animation: 'fade-up' },
      { id: `${id}-p`,     type: 'paragraph', content: body,                                                             x: 44, y: 220, width: 772, height: 360, zIndex: 2, animation: 'fade' },
      { id: `${id}-q`,     type: 'quote',     content: payload.retention_text || 'A retenir : structurez, illustrez, engagez.', x: 44, y: 620, width: 772, height: 76,  zIndex: 2, animation: 'spotlight' },
    ],
    ...fe,
  };
}
