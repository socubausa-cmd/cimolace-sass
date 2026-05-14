import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  MOBILE_REELS_SHELL_MAX_PX,
  isMobileReelsShellExcluded,
} from '@/lib/mobileReelsShellConfig';

export function useMobileReelsShellVisible() {
  const location = useLocation();
  const [wideMatches, setWideMatches] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia(`(max-width: ${MOBILE_REELS_SHELL_MAX_PX}px)`).matches
      : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_REELS_SHELL_MAX_PX}px)`);
    const fn = () => setWideMatches(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  return useMemo(() => {
    if (!wideMatches) return false;
    return !isMobileReelsShellExcluded(location.pathname, location.search);
  }, [wideMatches, location.pathname, location.search]);
}
