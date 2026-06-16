import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell } from 'lucide-react';
import { patientApi, type Notification } from '../lib/api';

// Cloche de notifications du portail patient.
//
// • Compteur de non-lus = notifications dont `read === false`.
// • Clic sur la cloche → panneau déroulant listant les notifs (titre, corps,
//   date), la plus récente en haut (l'API trie déjà `created_at` desc).
// • Clic sur une notif non lue → `POST /notifications/:id/read` (route POST
//   du contrat, pas PATCH), mise à jour optimiste `read:true`, puis refetch
//   pour resynchroniser le compteur avec le serveur.
// • Dégradation gracieuse : si l'endpoint échoue (401/404/503…), on garde la
//   liste vide → la cloche s'affiche SANS badge, aucun crash. White-label :
//   aucune mention d'infrastructure, couleur via var(--brand-primary).

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "À l'instant";
  if (min < 60) return `Il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `Il y a ${d} j`;
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const unread = items.filter((n) => !n.read).length;

  const fetchNotifications = useCallback(() => {
    patientApi
      .getMyNotifications()
      .then((list) => setItems(Array.isArray(list) ? list : []))
      // Dégradation : on garde la liste vide → cloche sans badge, pas de crash.
      .catch(() => setItems([]));
  }, []);

  // Chargement initial + rafraîchissement léger par polling (60 s) pour faire
  // remonter les nouveaux événements (formulaire assigné, message, note
  // partagée) sans realtime.
  useEffect(() => {
    fetchNotifications();
    const id = window.setInterval(fetchNotifications, 60000);
    return () => window.clearInterval(id);
  }, [fetchNotifications]);

  // Fermer le panneau au clic en dehors / touche Échap.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function markRead(n: Notification) {
    if (n.read) return;
    // Maj optimiste immédiate, puis refetch pour resynchroniser.
    setItems((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)),
    );
    patientApi
      .markNotificationRead(n.id)
      .then(() => fetchNotifications())
      // Si l'appel échoue, on resynchronise depuis le serveur (annule la maj
      // optimiste si elle n'a pas pris). Aucun crash.
      .catch(() => fetchNotifications());
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label="Notifications"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 40,
          borderRadius: 10,
          border: '1px solid #e2e8f0',
          background: '#fff',
          color: 'var(--brand-primary)',
          cursor: 'pointer',
        }}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span
            aria-label={`${unread} notification(s) non lue(s)`}
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              minWidth: 18,
              height: 18,
              padding: '0 5px',
              borderRadius: 9,
              background: 'var(--brand-primary)',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              lineHeight: '18px',
              textAlign: 'center',
              boxShadow: '0 0 0 2px #fff',
            }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 48,
            right: 0,
            width: 340,
            maxHeight: 420,
            overflowY: 'auto',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            boxShadow: '0 12px 32px rgba(15,23,42,0.16)',
            zIndex: 50,
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
              Notifications
            </span>
            {unread > 0 && (
              <span style={{ fontSize: 12, color: '#64748b' }}>
                {unread} non lue{unread > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {items.length === 0 ? (
            <div
              style={{
                padding: '28px 16px',
                textAlign: 'center',
                color: '#94a3b8',
                fontSize: 13,
              }}
            >
              Aucune notification
            </div>
          ) : (
            <ul style={{ listStyle: 'none' }}>
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => markRead(n)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      display: 'flex',
                      gap: 10,
                      padding: '12px 16px',
                      borderBottom: '1px solid #f1f5f9',
                      background: n.read ? '#fff' : 'var(--brand-primary-soft)',
                      cursor: n.read ? 'default' : 'pointer',
                    }}
                  >
                    {/* Pastille « non lu » */}
                    <span
                      aria-hidden="true"
                      style={{
                        marginTop: 6,
                        flexShrink: 0,
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        background: n.read
                          ? 'transparent'
                          : 'var(--brand-primary)',
                      }}
                    />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: 'block',
                          fontSize: 13,
                          fontWeight: n.read ? 500 : 700,
                          color: '#0f172a',
                        }}
                      >
                        {n.title}
                      </span>
                      {n.body && (
                        <span
                          style={{
                            display: 'block',
                            fontSize: 12,
                            color: '#475569',
                            marginTop: 2,
                          }}
                        >
                          {n.body}
                        </span>
                      )}
                      <span
                        style={{
                          display: 'block',
                          fontSize: 11,
                          color: '#94a3b8',
                          marginTop: 4,
                        }}
                      >
                        {timeAgo(n.created_at)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
