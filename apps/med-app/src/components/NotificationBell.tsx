import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check, ClipboardList, MessageCircle, FileText } from 'lucide-react';
import { notificationsApi, type Notification, type NotificationType } from '../lib/notifications-api';

// Intervalle de rafraîchissement du compteur (ms). Le backend n'expose pas de
// realtime pour les notifications → polling léger. 60 s = compromis fraîcheur /
// charge réseau, aligné sur la messagerie LIRI (polling, pas de socket).
const POLL_MS = 60_000;

// Icône + libellé par type (Events 1/2/3 du contrat backend). Un type inconnu
// retombe sur la cloche générique — la cloche ne casse jamais sur un type futur.
const TYPE_META: Record<string, { icon: React.ComponentType<{ size?: number; color?: string }>; label: string }> = {
  form_assignment: { icon: ClipboardList, label: 'Formulaire' },
  message: { icon: MessageCircle, label: 'Message' },
  note_shared: { icon: FileText, label: 'Note partagée' },
};

function metaFor(type: NotificationType) {
  return TYPE_META[type] ?? { icon: Bell, label: 'Notification' };
}

// Horodatage relatif compact en français (« à l'instant », « il y a 5 min »…).
function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '';
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  if (j < 7) return `il y a ${j} j`;
  return new Date(iso).toLocaleDateString('fr');
}

export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false); // 1er fetch terminé (succès OU échec)
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const unread = items.filter((n) => !n.read).length;

  // Récupère la liste. Best-effort : en cas d'échec (réseau, 401, pas de
  // tenant…) on garde l'état courant sans casser le shell — dégradation
  // gracieuse, aucune erreur affichée dans la topbar.
  const load = useCallback(async () => {
    try {
      const data = await notificationsApi.list();
      setItems(data);
    } catch {
      // silencieux — la cloche reste, juste sans badge
    } finally {
      setReady(true);
    }
  }, []);

  // Polling : 1er chargement immédiat + toutes les POLL_MS. On recharge aussi à
  // l'ouverture du panneau pour une liste fraîche au clic.
  useEffect(() => {
    load();
    const id = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  // Fermer au clic extérieur + touche Échap (uniquement quand ouvert).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) load(); // liste fraîche à l'ouverture
  };

  // Marquage lu optimiste : on bascule read:true immédiatement, puis on
  // confirme côté serveur. En cas d'échec on recharge pour resynchroniser.
  const markRead = useCallback(
    async (n: Notification) => {
      if (n.read) return;
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      try {
        await notificationsApi.markRead(n.id);
      } catch {
        load(); // rollback via re-sync
      }
    },
    [load],
  );

  // Tout marquer comme lu — boucle sur les non-lus (pas d'endpoint bulk au
  // contrat). Optimiste, best-effort.
  const markAllRead = useCallback(async () => {
    const toMark = items.filter((n) => !n.read);
    if (toMark.length === 0) return;
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    try {
      await Promise.all(toMark.map((n) => notificationsApi.markRead(n.id)));
    } catch {
      load();
    }
  }, [items, load]);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={toggle}
        aria-label="Notifications"
        aria-haspopup="true"
        aria-expanded={open}
        title="Notifications"
        style={{
          position: 'relative',
          width: 40,
          height: 40,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 10,
          border: '1px solid var(--zw-border)',
          background: open ? 'var(--zw-bg-subtle)' : 'var(--zw-bg, #fff)',
          color: 'var(--zw-text-soft)',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <Bell size={19} />
        {ready && unread > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              padding: '0 5px',
              borderRadius: 9,
              background: 'var(--brand-primary, #ef4444)',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              lineHeight: '18px',
              textAlign: 'center',
              boxShadow: '0 0 0 2px var(--zw-bg, #fff)',
            }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Panneau de notifications"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 360,
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 440,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--zw-bg, #fff)',
            border: '1px solid var(--zw-border)',
            borderRadius: 14,
            boxShadow: '0 12px 32px rgba(15,23,42,0.16)',
            zIndex: 50,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderBottom: '1px solid var(--zw-border)',
            }}
          >
            <b style={{ fontSize: 14, color: 'var(--zw-text)' }}>
              Notifications{unread > 0 ? ` (${unread})` : ''}
            </b>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--brand-primary, #3b82f6)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <Check size={13} /> Tout marquer lu
              </button>
            )}
          </div>

          <div style={{ overflowY: 'auto' }}>
            {items.length === 0 ? (
              <div
                style={{
                  padding: '28px 16px',
                  textAlign: 'center',
                  color: 'var(--zw-text-muted)',
                  fontSize: 13,
                }}
              >
                {ready ? 'Aucune notification.' : 'Chargement…'}
              </div>
            ) : (
              items.map((n) => {
                const m = metaFor(n.type);
                const Icon = m.icon;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => markRead(n)}
                    style={{
                      display: 'flex',
                      gap: 10,
                      width: '100%',
                      textAlign: 'left',
                      padding: '11px 14px',
                      border: 'none',
                      borderBottom: '1px solid var(--zw-bg-subtle)',
                      background: n.read ? 'transparent' : 'var(--brand-primary-soft, #eff6ff)',
                      cursor: n.read ? 'default' : 'pointer',
                    }}
                  >
                    <span
                      style={{
                        flexShrink: 0,
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        display: 'grid',
                        placeItems: 'center',
                        background: 'var(--zw-bg-subtle)',
                        color: 'var(--brand-primary, #3b82f6)',
                      }}
                    >
                      <Icon size={16} />
                    </span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span
                        style={{
                          display: 'block',
                          fontSize: 13,
                          fontWeight: n.read ? 500 : 700,
                          color: 'var(--zw-text)',
                          marginBottom: 2,
                        }}
                      >
                        {n.title || m.label}
                      </span>
                      {n.body && (
                        <span
                          style={{
                            display: 'block',
                            fontSize: 12,
                            color: 'var(--zw-text-soft)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {n.body}
                        </span>
                      )}
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--zw-text-faint)', marginTop: 3 }}>
                        {timeAgo(n.created_at)}
                      </span>
                    </span>
                    {!n.read && (
                      <span
                        aria-hidden="true"
                        style={{
                          flexShrink: 0,
                          alignSelf: 'center',
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: 'var(--brand-primary, #3b82f6)',
                        }}
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
