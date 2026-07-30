import { useEffect, useRef, useState } from 'react';

/**
 * NARRATION D'UNE SCÈNE — loi 2 du cahier des charges « Tableau Vivant » :
 * « Chaque bloc apparaît QUAND la voix off l'aborde. La narration pilote le
 * tableau. »
 *
 * Principe de synchronisation, volontairement SANS canal temps réel dédié :
 * l'hôte et chaque invité jouent la MÊME piste (`live_scenes.audio_url`) depuis
 * le même instant de départ, donc la révélation avance au même rythme partout.
 * On évite ainsi un aller-retour réseau par palier — un broadcast par palier
 * dériverait de toute façon plus vite que l'audio lui-même.
 *
 * Ce que ce hook NE fait PAS (et qu'il ne faut pas croire) :
 * - il ne rattrape pas un invité qui rejoint en cours de scène : celui-là
 *   démarre la narration au début (comportement assumé, mieux que le silence) ;
 * - il ne remplace pas la voix live du professeur : c'est une narration
 *   PRÉ-ENREGISTRÉE, pensée pour les scènes préparées à l'avance.
 */
export function useSceneNarration({
  audioUrl,
  sceneId,
  maxStep,
  enabled = true,
  onStep,
}) {
  const audioRef = useRef(null);
  const onStepRef = useRef(onStep);
  const lastStepRef = useRef(-1);
  const [playing, setPlaying] = useState(false);
  const [available, setAvailable] = useState(false);

  useEffect(() => { onStepRef.current = onStep; }, [onStep]);

  useEffect(() => {
    const url = String(audioUrl || '').trim();
    setAvailable(!!url);
    lastStepRef.current = -1;
    if (!url || !enabled) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlaying(false);
      return undefined;
    }

    const audio = new Audio(url);
    audio.preload = 'auto';
    audioRef.current = audio;

    const steps = Math.max(1, Number(maxStep) || 1);
    const onTime = () => {
      const total = Number(audio.duration);
      if (!Number.isFinite(total) || total <= 0) return;
      // Le palier suit la PROGRESSION de la voix : à mi-narration, on est à la
      // moitié des révélations. Pas de retour en arrière automatique — un
      // rembobinage involontaire ne doit pas effacer le tableau sous les yeux.
      const ratio = Math.min(1, Math.max(0, audio.currentTime / total));
      const next = Math.min(steps, Math.floor(ratio * (steps + 1)));
      if (next > lastStepRef.current) {
        lastStepRef.current = next;
        onStepRef.current?.(next);
      }
    };
    const onEnded = () => {
      setPlaying(false);
      // Fin de narration = tableau complet : l'élève doit voir la synthèse.
      if (lastStepRef.current < steps) {
        lastStepRef.current = steps;
        onStepRef.current?.(steps);
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.pause();
      if (audioRef.current === audio) audioRef.current = null;
    };
    // `sceneId` est dans les dépendances : changer de scène doit repartir de zéro
    // même si deux scènes partagent par accident la même URL.
  }, [audioUrl, sceneId, maxStep, enabled]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      // Une lecture refusée (politique d'autoplay du navigateur) ne doit pas
      // casser la scène : on retombe simplement en pilotage manuel.
      void audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  };

  const restart = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    lastStepRef.current = -1;
    void audio.play().catch(() => setPlaying(false));
  };

  return { available, playing, toggle, restart };
}
