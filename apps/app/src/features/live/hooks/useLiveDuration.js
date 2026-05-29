import { useEffect, useState } from 'react';

export function useLiveDuration(startedAt) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!startedAt) return;

    const base = Date.now() - new Date(startedAt).getTime();
    setSeconds(Math.floor(base / 1000));

    const timer = setInterval(() => setSeconds((currentSeconds) => currentSeconds + 1), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
