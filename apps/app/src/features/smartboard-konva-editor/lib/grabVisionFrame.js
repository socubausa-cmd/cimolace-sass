/**
 * Extrait une image JPEG (data URL) depuis un élément video, avec redimensionnement optionnel.
 * @param {HTMLVideoElement} video
 * @param {{ maxWidth?: number; quality?: number }} [opts]
 * @returns {string | null}
 */
export function grabVisionFrameDataUrl(video, opts = {}) {
  const maxW = opts.maxWidth ?? 960;
  const quality = typeof opts.quality === 'number' ? opts.quality : 0.68;
  const vw = video?.videoWidth;
  const vh = video?.videoHeight;
  if (!vw || !vh) return null;
  const scale = vw > maxW ? maxW / vw : 1;
  const c = document.createElement('canvas');
  c.width = Math.round(vw * scale);
  c.height = Math.round(vh * scale);
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}
