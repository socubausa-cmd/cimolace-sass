/**
 * Contrôle d'application intégrée — aligné sur le pack local LIRI_FULL_SYSTEM.
 * Navigateur : prévisualisation / simulation ; Electron + preload : listage fenêtres + injection IPC.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Monitor } from 'lucide-react';
import StudioDesignerLikeShell from '@/components/liri/liri-ecosystem/StudioDesignerLikeShell';
import EmbeddedAppSurface from '@/components/liri/EmbeddedAppSurface';
import { buildCommand } from '@/lib/liriEmbeddedControl/commandBridge.js';
import { DEFAULT_MAPPER } from '@/lib/liriEmbeddedControl/mapper.js';
import {
  getEmbeddedControlApi,
  hasNativeEmbeddedShell,
  injectNativeCommand,
  persistEmbeddedAppLock,
  clearEmbeddedAppLock,
} from '@/lib/liriEmbeddedControl/nativeShell.js';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const LONGIA_CHIPS = [
  { label: 'Repère visuel', action: 'hint_overlay' },
  { label: 'Pause saisie', action: 'pause_input' },
];

export default function StudioLiriEmbeddedControlPage() {
  const { toast } = useToast();
  const mapperRef = useRef({ ...DEFAULT_MAPPER });
  const [native, setNative] = useState(false);
  const [sources, setSources] = useState([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [runtimeState, setRuntimeState] = useState({
    status: 'idle',
    focusMode: 'app',
    inputEnabled: false,
  });
  const [lastCommandLog, setLastCommandLog] = useState([]);

  useEffect(() => {
    setNative(hasNativeEmbeddedShell());
  }, []);

  const refreshState = useCallback(async () => {
    const api = getEmbeddedControlApi();
    if (!api?.getState) return;
    try {
      const s = await api.getState();
      if (s && typeof s === 'object') {
        if (s.sourceLocked === true && s.sourceName) {
          persistEmbeddedAppLock(String(s.sourceName));
        } else if (s.sourceLocked === false) {
          clearEmbeddedAppLock();
        }
        setRuntimeState((prev) => ({
          ...prev,
          status: typeof s.status === 'string' ? s.status : prev.status,
          focusMode: typeof s.focusMode === 'string' ? s.focusMode : prev.focusMode,
          inputEnabled: s.inputEnabled !== false,
        }));
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refreshState();
    const t = setInterval(() => void refreshState(), 8000);
    return () => clearInterval(t);
  }, [refreshState]);

  const loadSources = useCallback(async () => {
    const api = getEmbeddedControlApi();
    if (!api?.listSources) {
      toast({
        title: 'Shell natif requis',
        description: 'Lance l\'app via le projet Electron du pack LIRI_FULL_SYSTEM (preload embeddedControlAPI).',
        variant: 'destructive',
      });
      return;
    }
    setLoadingSources(true);
    try {
      const list = await api.listSources();
      setSources(Array.isArray(list) ? list : []);
    } catch (e) {
      toast({
        title: 'Sources',
        description: e?.message ? String(e.message) : 'Impossible de lister les fenêtres.',
        variant: 'destructive',
      });
    } finally {
      setLoadingSources(false);
    }
  }, [toast]);

  const lockSource = useCallback(
    async (src) => {
      const api = getEmbeddedControlApi();
      if (!api?.lockSource) return;
      try {
        const next = await api.lockSource(src);
        if (next && typeof next === 'object') {
          setRuntimeState((prev) => ({
            ...prev,
            status: typeof next.status === 'string' ? next.status : 'active',
            focusMode: typeof next.focusMode === 'string' ? next.focusMode : prev.focusMode,
            inputEnabled: next.inputEnabled !== false,
          }));
        }
        const thumb = src?.thumbnail;
        setPreviewUrl(typeof thumb === 'string' ? thumb : null);
        persistEmbeddedAppLock(String(src?.name || 'Application'));
        toast({ title: 'Source verrouillée', description: String(src?.name || 'OK') });
      } catch (e) {
        toast({
          title: 'Verrouillage',
          description: e?.message ? String(e.message) : 'Échec',
          variant: 'destructive',
        });
      }
    },
    [toast],
  );

  const unlockSource = useCallback(async () => {
    const api = getEmbeddedControlApi();
    if (!api?.unlockSource) return;
    try {
      await api.unlockSource();
      clearEmbeddedAppLock();
      setPreviewUrl(null);
      setRuntimeState((p) => ({ ...p, status: 'idle', inputEnabled: false }));
      toast({ title: 'Source libérée' });
    } catch (e) {
      toast({
        title: 'Déverrouillage',
        description: e?.message ? String(e.message) : 'Échec',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const setFocusMode = useCallback(
    async (mode) => {
      const api = getEmbeddedControlApi();
      if (!api?.setFocusMode) {
        setRuntimeState((p) => ({ ...p, focusMode: mode }));
        return;
      }
      try {
        const next = await api.setFocusMode(mode);
        if (next && typeof next === 'object' && typeof next.focusMode === 'string') {
          setRuntimeState((p) => ({ ...p, focusMode: next.focusMode }));
        } else {
          setRuntimeState((p) => ({ ...p, focusMode: mode }));
        }
      } catch {
        setRuntimeState((p) => ({ ...p, focusMode: mode }));
      }
    },
    [],
  );

  const pushLog = useCallback((entry) => {
    setLastCommandLog((prev) => [...prev.slice(-19), { at: Date.now(), ...entry }]);
  }, []);

  const onInputEvent = useCallback(
    async (evt) => {
      const cmd = buildCommand(evt, mapperRef.current);
      if (!cmd) return;
      pushLog({ kind: 'ui', cmd });
      const res = await injectNativeCommand(cmd);
      const ok = res && typeof res === 'object' && res.ok !== false;
      if (!ok && res?.reason === 'no_native_shell') {
        pushLog({ kind: 'stub', cmd, note: 'Navigateur — pas d\'injection OS' });
        return;
      }
      pushLog({ kind: 'result', res });
      if (!ok) {
        const reason = typeof res?.reason === 'string' ? res.reason : 'Refusée ou erreur';
        const extra =
          reason === 'native_binary_missing'
            ? ' Dans le dossier LIRI_FULL_SYSTEM : npm run build:native (génère bin/native-bridge-macos).'
            : reason === 'accessibility_permission_missing'
              ? ' macOS : autoriser Accessibilité pour Terminal ou Electron.'
              : '';
        toast({
          title: 'Injection',
          description: `${reason}.${extra}`,
          variant: 'destructive',
        });
      }
    },
    [pushLog, toast],
  );

  const onMapperChange = useCallback((m) => {
    mapperRef.current = m;
  }, []);

  const onLongiaAction = useCallback(
    (action) => {
      if (action === 'pause_input') {
        setRuntimeState((p) => ({ ...p, inputEnabled: false }));
        toast({
          title: 'Saisie',
          description: 'Saisie sur la surface désactivée (réactive avec le focus ou le shell si besoin).',
        });
        return;
      }
      if (action === 'hint_overlay') {
        toast({
          title: 'Repère visuel',
          description: 'À terme : surcouche pédagogique sur l\'aperçu (flèches, zones). Pour l\'instant, utilise les clics sur la surface.',
        });
        return;
      }
      toast({
        title: 'LONGIA',
        description: 'Action pédagogique — brancher au bus LONGIA si besoin.',
      });
    },
    [toast],
  );

  return (
    <StudioDesignerLikeShell
      railActiveKey="embedded"
      pageLabel="Contrôle intégré"
      /* `cyan` était une CLÉ de la table ACCENT du shell, pas une couleur : elle pointe
         déjà sur l'or #e3aa6b. On passe à son alias chaud `or` — même objet, rendu
         strictement identique — pour que plus aucun nom froid ne traîne dans le code. */
      pageAccent="or"
      TitleIcon={Monitor}
      titleLine="App intégrée (LIRI_FULL_SYSTEM)"
      breadcrumbMiddle={[{ label: 'Hub', href: '/studio/liri' }]}
    >
      <div className="mx-auto flex h-full min-h-0 max-w-6xl flex-col gap-4 px-4 py-6">
        <div
          className={cn(
            'rounded-xl border px-4 py-3 text-[13px]',
            /* Bandeau d'état : le VERT reste, c'est un SIGNAL (« Shell natif détecté »
               = connecté) opposé à l'ambre du repli navigateur. Mais la famille
               emerald est avalée par studioWarm.css (remap fond/texte/bordure →
               corail) : à l'écran, l'état natif devenait un orange quasi identique
               à l'ambre du mode dégradé, et l'utilisateur perdait la distinction.
               On passe donc sur la
               famille `green-*`, que studioWarm.css EXEMPTE explicitement (« vert et
               rouge purs = sémantiques succès/danger → préservés ») — et qui est aussi
               plus chaude qu'emerald, lequel confine au teal banni.
               green-100/90 sur le fond composé #26362a = 9,77:1. */
            native ? 'border-green-500/25 bg-green-500/10 text-green-100/90' : 'border-amber-500/25 bg-amber-500/10 text-amber-100/90',
          )}
        >
          {native ? (
            <span>
              Shell natif détecté — les commandes sont envoyées via <code className="rounded bg-black/30 px-1">embedded:inject-command</code> ou{' '}
              <code className="rounded bg-black/30 px-1">native-bridge:inject</code>.
            </span>
          ) : (
            <span>
              Mode navigateur : tu peux tester le mapping et voir les commandes construites ; pour l'injection macOS (Accessibilité), ouvre cette même UI dans le shell Electron du dossier{' '}
              <code className="rounded bg-black/30 px-1">LIRI_FULL_SYSTEM</code>.
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[12px] font-medium text-white/85 transition hover:bg-white/10"
            onClick={() => void loadSources()}
            disabled={loadingSources}
          >
            {loadingSources ? 'Chargement…' : 'Lister les fenêtres'}
          </button>
          <button
            type="button"
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[12px] font-medium text-white/85 transition hover:bg-white/10"
            onClick={() => void unlockSource()}
          >
            Libérer la source
          </button>
          {(['app', 'liri', 'mixed']).map((m) => (
            <button
              key={m}
              type="button"
              className={cn(
                'rounded-lg border px-3 py-2 text-[12px] font-medium transition',
                /* État ACTIF du sélecteur de focus : violet → corail plein-voile.
                   LA DISTINCTION ACTIF/INACTIF EST PRÉSERVÉE, elle se joue sur les
                   mêmes trois leviers qu'avant : filet marqué (60 % vs 10 %), fond
                   teinté (corail 25 % vs blanc 4 %) et encre pleine (blanc vs 60 %).
                   Blanc sur le fond composé #533a31 = 10,41:1. (25 et non 22 : Tailwind
                   3.4 n'émet que les opacités multiples de 5.) */
                runtimeState.focusMode === m
                  ? 'border-[#d97757]/60 bg-[#d97757]/25 text-white'
                  : 'border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/10',
              )}
              onClick={() => void setFocusMode(m)}
            >
              Focus {m}
            </button>
          ))}
        </div>

        {sources.length > 0 ? (
          <div className="max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.02] p-2">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-white/40">
              <Monitor className="h-3.5 w-3.5" />
              Fenêtres capturables
            </div>
            <ul className="flex flex-col gap-1">
              {sources.map((s) => (
                <li key={String(s.id)}>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-transparent px-2 py-2 text-left text-[12px] text-white/75 hover:border-white/10 hover:bg-white/5"
                    onClick={() => void lockSource(s)}
                  >
                    {String(s.name || s.id || '?')}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
          <div className="flex min-h-[320px] min-w-0 flex-1 flex-col">
            <EmbeddedAppSurface
              previewUrl={previewUrl}
              runtimeState={runtimeState}
              onMapperChange={onMapperChange}
              onInputEvent={onInputEvent}
              longiaActions={LONGIA_CHIPS}
              onLongiaAction={onLongiaAction}
            />
          </div>
          <div className="w-full shrink-0 rounded-xl border border-white/10 bg-black/30 p-3 lg:w-80">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/40">Journal commandes</div>
            <ul className="max-h-[min(52vh,420px)] space-y-2 overflow-y-auto text-[11px] text-white/65">
              {lastCommandLog.length === 0 ? (
                <li className="text-white/35">Aucun événement encore.</li>
              ) : (
                lastCommandLog
                  .slice()
                  .reverse()
                  .map((row, i) => (
                    <li key={`${row.at}-${i}`} className="rounded border border-white/5 bg-white/[0.03] p-2 font-mono leading-snug">
                      <span className="text-white/40">{new Date(row.at).toLocaleTimeString()}</span>{' '}
                      {/* Journal : TROIS natures d'événement, donc TROIS encres qui doivent
                          rester lisibles ET distinctes. Avant, le cyan 300 et
                          l'emerald 300 étaient tous deux ramenés à #e0926a par
                          (noms de classes volontairement NON écrits en toutes lettres :
                          l'extracteur Tailwind scanne aussi les commentaires et
                          générerait la règle d'une couleur bannie dans le bundle)
                          studioWarm.css → « ui » et « result » se confondaient à l'écran.
                          On pose donc les hex de la rampe, hors d'atteinte du remap :
                          ui = corail #e8a97f (8,59:1) · stub = ambre #e0a458 (7,93:1) ·
                          result = olive #8fbf7a (8,16:1, la teinte « succès/validé »),
                          tous sur le fond composé du panneau (noir 30 % ≈ #1b1b19). */}
                      {row.kind === 'ui' && <span className="text-[#e8a97f]">{JSON.stringify(row.cmd)}</span>}
                      {row.kind === 'stub' && (
                        <span className="text-[#e0a458]">
                          {JSON.stringify(row.cmd)} — {row.note}
                        </span>
                      )}
                      {row.kind === 'result' && <span className="text-[#8fbf7a]">{JSON.stringify(row.res)}</span>}
                    </li>
                  ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </StudioDesignerLikeShell>
  );
}
