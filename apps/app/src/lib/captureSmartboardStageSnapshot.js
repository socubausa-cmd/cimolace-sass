/**
 * Capture PNG of the SmartBoard bordered stage.
 * 1) html-to-image — DOM / CSS / text / stacking proches du rendu réel.
 * 2) repli — fusion canvas + video + img seulement (CORS, échec clone, etc.).
 */

import { toBlob } from 'html-to-image';

const MIN_BLOB_BYTES = 80;

function isDrawableMedia(node, rootRect) {
  if (!node || !rootRect) return false;
  const st = window.getComputedStyle(node);
  if (st.display === 'none' || st.visibility === 'hidden') return false;
  const op = parseFloat(st.opacity || '1');
  if (!Number.isFinite(op) || op < 0.05) return false;
  const r = node.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  if (r.bottom < rootRect.top || r.top > rootRect.bottom || r.right < rootRect.left || r.left > rootRect.right) {
    return false;
  }
  return true;
}

/**
 * Fusion manuelle des médias (fallback).
 * @param {HTMLElement} rootEl
 * @param {number} maxSide
 * @returns {Promise<Blob|null>}
 */
async function captureSmartboardStageMediaMergeToPngBlob(rootEl, maxSide) {
  const rect = rootEl.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  const scale = Math.min(maxSide / Math.max(rect.width, rect.height), 2);
  const w = Math.round(rect.width * scale);
  const h = Math.round(rect.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#12111a';
  ctx.fillRect(0, 0, w, h);

  const nodes = Array.from(rootEl.querySelectorAll('canvas, video, img'));
  for (const node of nodes) {
    if (!isDrawableMedia(node, rect)) continue;
    const r = node.getBoundingClientRect();
    const x = (r.left - rect.left) * scale;
    const y = (r.top - rect.top) * scale;
    const rw = r.width * scale;
    const rh = r.height * scale;
    try {
      if (node.tagName === 'CANVAS') {
        ctx.drawImage(node, x, y, rw, rh);
      } else if (node.tagName === 'VIDEO') {
        if (node.readyState >= 2) {
          ctx.drawImage(node, x, y, rw, rh);
        }
      } else if (node.tagName === 'IMG' && node.naturalWidth) {
        ctx.drawImage(node, x, y, rw, rh);
      }
    } catch {
      /* CORS / tainted sources */
    }
  }

  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png', 0.92);
  });
}

/**
 * @param {HTMLElement} rootEl — bordered SmartBoard frame (ref from SmartBoardCompositor)
 * @param {{ maxSide?: number }} [options]
 * @returns {Promise<Blob|null>}
 */
export async function captureSmartboardStageToPngBlob(rootEl, options = {}) {
  if (typeof document === 'undefined' || !rootEl || typeof rootEl.getBoundingClientRect !== 'function') {
    return null;
  }

  const maxSide = options.maxSide ?? 1680;
  const rect = rootEl.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);

  const pixelRatio = Math.min(2, maxSide / Math.max(rect.width, rect.height, 1));

  try {
    const blob = await toBlob(rootEl, {
      type: 'image/png',
      cacheBust: true,
      pixelRatio,
      backgroundColor: '#12111a',
    });
    if (blob && blob.size >= MIN_BLOB_BYTES) {
      return blob;
    }
  } catch (e) {
    console.warn('[captureSmartboardStage] html-to-image failed, fallback media merge', e?.message || e);
  }

  return captureSmartboardStageMediaMergeToPngBlob(rootEl, maxSide);
}
