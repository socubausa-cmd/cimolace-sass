/**
 * useCamera — Hook React pour prise de photo (Capacitor Camera).
 *
 * - Sur natif : ouvre la caméra système (resultType=DataUrl), renvoie un
 *   File prêt à FormData (utile pour /documents/upload du LabReaderPanel).
 * - Sur web   : fallback `<input type="file" capture="environment">` —
 *   ouvre la caméra du téléphone dans Safari/Chrome quand dispo, sinon
 *   le picker fichiers classique.
 */
import { useCallback, useState } from 'react';

export interface UseCameraReturn {
  isNative: boolean;
  busy: boolean;
  error: string | null;
  /** Capture une photo. Retourne un File (JPEG) ou null si annulé. */
  takePhoto: (opts?: { quality?: number; filename?: string }) => Promise<File | null>;
}

/** Convertit un DataURL base64 en File JPEG/PNG. */
function dataUrlToFile(dataUrl: string, filename: string): File {
  const [meta, b64] = dataUrl.split(',');
  const mimeMatch = /data:([^;]+);base64/.exec(meta || '');
  const mime = mimeMatch?.[1] ?? 'image/jpeg';
  const binary = atob(b64 ?? '');
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

/** Fallback web : ouvre un <input type=file capture=environment>. */
function pickFromWeb(filename: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    // Hint pour iOS/Android Safari : ouvrir directement la caméra.
    input.setAttribute('capture', 'environment');
    input.style.display = 'none';

    let settled = false;
    const finish = (f: File | null) => {
      if (settled) return;
      settled = true;
      try { document.body.removeChild(input); } catch { /* no-op */ }
      resolve(f);
    };

    input.onchange = () => {
      const f = input.files?.[0] ?? null;
      if (f && filename && f.name !== filename) {
        // Renomme pour stabilité côté backend.
        finish(new File([f], filename, { type: f.type }));
      } else {
        finish(f);
      }
    };
    // Si l'utilisateur ferme sans choisir, l'événement focus revient sans changement.
    // Pas de cleanup automatique fiable cross-browser → on laisse l'élément en place
    // jusqu'au prochain choix. Cas rare en pratique.

    document.body.appendChild(input);
    input.click();
  });
}

export function useCamera(): UseCameraReturn {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNative, setIsNative] = useState<boolean>(false);

  const takePhoto = useCallback(async (opts?: { quality?: number; filename?: string }): Promise<File | null> => {
    setBusy(true); setError(null);
    const filename = opts?.filename ?? `photo-${Date.now()}.jpg`;
    try {
      const { Capacitor } = await import('@capacitor/core');
      const native = Capacitor.isNativePlatform();
      setIsNative(native);

      if (!native) {
        return await pickFromWeb(filename);
      }

      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const photo = await Camera.getPhoto({
        quality: opts?.quality ?? 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        saveToGallery: false,
      });
      const dataUrl = photo.dataUrl;
      if (!dataUrl) {
        setError('Aucune image renvoyée par la caméra.');
        return null;
      }
      return dataUrlToFile(dataUrl, filename);
    } catch (e: any) {
      // L'utilisateur peut annuler la caméra → message neutre.
      const msg = e?.message || 'Capture annulée ou indisponible.';
      setError(msg);
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  return { isNative, busy, error, takePhoto };
}
