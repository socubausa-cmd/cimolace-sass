/**
 * Signature à la lecture des assets du bucket PRIVÉ `smartboard-canvas`.
 *
 * Le bucket est passé en privé (cf. migration `*_smartboard_canvas_private.sql`) :
 * les anciennes URLs `.../object/public/smartboard-canvas/...` renvoient désormais 403.
 * On ne stocke JAMAIS d'URL signée (elle expire) — on garde en base la forme durable
 * (URL publique / chemin nu, qui encode le storagePath) et on re-signe au dernier moment,
 * juste avant le rendu, via un cache mémoire à TTL.
 *
 * Fail-soft : si la signature échoue (hors-ligne, non authentifié…), on renvoie la valeur
 * d'origine plutôt que de casser le rendu.
 */
import { supabase } from '@/lib/customSupabaseClient';
import { useEffect, useState } from 'react';
import { SMARTBOARD_CANVAS_BUCKET } from '@/lib/uploadSmartboardCanvasImage';

/** Durée de validité demandée pour une URL signée. */
const SIGN_TTL_SECONDS = 60 * 60; // 1 h
/** Marge avant expiration pour re-signer (évite une URL périmée en cours de rendu). */
const REFRESH_MARGIN_MS = 60 * 1000;

/** storagePath -> { url, expiresAt } */
const signedCache = new Map();

const MARKER = `/${SMARTBOARD_CANVAS_BUCKET}/`;

/**
 * Extrait le chemin Storage (`{uid}/{fichier}`) d'une valeur stockée.
 * Accepte : URL publique `.../object/public/smartboard-canvas/<path>`, URL signée
 * `.../object/sign/smartboard-canvas/<path>?token=…`, ou chemin nu `<uid>/<fichier>`.
 * Renvoie `null` pour tout ce qui n'est pas un asset du bucket (URL externe, data:, blob:).
 * @param {unknown} value
 * @returns {string | null}
 */
export function smartboardCanvasStoragePath(value) {
  if (!value || typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;

  // URL (publique ou signée) pointant vers le bucket → on récupère la portion après le marqueur.
  const idx = v.indexOf(MARKER);
  if (idx !== -1) {
    let path = v.slice(idx + MARKER.length);
    const q = path.indexOf('?');
    if (q !== -1) path = path.slice(0, q);
    path = path.replace(/^\/+/, '');
    try {
      path = decodeURIComponent(path);
    } catch {
      /* garde la forme brute si non décodable */
    }
    return path || null;
  }

  // URL externe / data / blob / chemin absolu → pas un asset du bucket.
  if (/^(https?:|data:|blob:|ftp:)/i.test(v) || v.startsWith('/')) return null;

  // Chemin nu de type `{uid}/{fichier}` (ce que stocke designer_ia_images.storage_path).
  if (v.includes('/') && !/\s/.test(v)) return v;

  return null;
}

/** Vrai si la valeur est un asset du bucket privé (donc à re-signer avant rendu). */
export function isSmartboardCanvasAsset(value) {
  return smartboardCanvasStoragePath(value) !== null;
}

/**
 * Renvoie une URL signée fraîche pour un asset `smartboard-canvas`.
 * Passe-plat (renvoie la valeur telle quelle) pour toute valeur non-bucket, vide,
 * ou en cas d'échec de signature.
 * @param {unknown} value URL stockée ou chemin Storage.
 * @returns {Promise<string>}
 */
export async function signSmartboardCanvasUrl(value) {
  const path = smartboardCanvasStoragePath(value);
  if (!path) return typeof value === 'string' ? value : '';

  const cached = signedCache.get(path);
  if (cached?.url && cached.expiresAt > Date.now() + REFRESH_MARGIN_MS) {
    return cached.url;
  }

  try {
    const { data, error } = await supabase.storage
      .from(SMARTBOARD_CANVAS_BUCKET)
      .createSignedUrl(path, SIGN_TTL_SECONDS);
    if (error || !data?.signedUrl) {
      return typeof value === 'string' ? value : '';
    }
    signedCache.set(path, {
      url: data.signedUrl,
      expiresAt: Date.now() + SIGN_TTL_SECONDS * 1000,
    });
    return data.signedUrl;
  } catch {
    return typeof value === 'string' ? value : '';
  }
}

/**
 * Hook React : résout une valeur stockée en URL affichable (signée si asset du bucket privé).
 * Pour un asset du bucket, l'état initial est vide afin d'éviter de charger l'ancienne URL
 * publique (qui renverrait 403) avant que l'URL signée n'arrive. Les URLs externes / data /
 * blob sont renvoyées immédiatement, sans appel réseau.
 * @param {unknown} value
 * @returns {string} src prête pour `<img>` / `<video>` / `Image()`.
 */
export function useSmartboardCanvasSrc(value) {
  const [src, setSrc] = useState(() =>
    isSmartboardCanvasAsset(value) ? '' : typeof value === 'string' ? value : '',
  );

  useEffect(() => {
    let alive = true;
    if (!value || typeof value !== 'string') {
      setSrc('');
      return () => {
        alive = false;
      };
    }
    if (!isSmartboardCanvasAsset(value)) {
      setSrc(value);
      return () => {
        alive = false;
      };
    }
    // Asset du bucket privé : on repart d'un état vide puis on résout l'URL signée.
    setSrc('');
    signSmartboardCanvasUrl(value).then((resolved) => {
      if (alive) setSrc(resolved);
    });
    return () => {
      alive = false;
    };
  }, [value]);

  return src;
}
