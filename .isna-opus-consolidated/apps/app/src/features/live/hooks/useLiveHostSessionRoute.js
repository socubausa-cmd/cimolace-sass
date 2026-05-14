import { useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { parseLiveSessionIdFromRouteParam, replaceRouteLastSegmentWithSessionId } from '@/lib/liveSessionRouteId';

const DEV_LIRI_HOST_LIVE_COACH_SCOPE_ID = '00000000-0000-4000-8000-000000000001';

/**
 * Session UUID depuis l’URL, normalisation du path « sale », et scope coach LONGIA
 * (y compris preview `/dev/liri-host-live` sans `:sessionId`).
 */
export function useLiveHostSessionRoute() {
  const { sessionId: sessionIdParam } = useParams();
  const sessionId = useMemo(
    () => parseLiveSessionIdFromRouteParam(sessionIdParam),
    [sessionIdParam],
  );
  const navigate = useNavigate();
  const location = useLocation();

  const isDevLiriHostLivePreview = useMemo(
    () => import.meta.env.DEV && /^\/dev\/liri-host-live\/?$/i.test(location.pathname),
    [location.pathname],
  );

  const coachScopeSessionId = sessionId || (isDevLiriHostLivePreview ? DEV_LIRI_HOST_LIVE_COACH_SCOPE_ID : '');

  /** URL « sale » (doc collée après l’UUID) → même route avec dernier segment = UUID seul. */
  useEffect(() => {
    if (!sessionId || sessionIdParam == null) return;
    let raw = String(sessionIdParam).trim();
    try {
      raw = decodeURIComponent(raw);
    } catch {
      /* ignore */
    }
    raw = raw.trim();
    if (raw === sessionId) return;
    const nextPath = replaceRouteLastSegmentWithSessionId(location.pathname, sessionId);
    if (!nextPath || nextPath === location.pathname) return;
    navigate(`${nextPath}${location.search || ''}${location.hash || ''}`, { replace: true });
  }, [sessionId, sessionIdParam, location.pathname, location.search, location.hash, navigate]);

  return { sessionId, sessionIdParam, coachScopeSessionId };
}
