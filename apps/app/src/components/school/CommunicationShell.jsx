import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageCircle, MessagesSquare } from 'lucide-react';
import StudentForumRedesign from '@/pages/school/student-school-life/StudentForumRedesign';
import MessagingPage from '@/pages/MessagingPage';

/**
 * Shell de COMMUNICATION unifié — onglets « Forum » / « Messagerie ».
 *
 * POURQUOI : le forum et la messagerie immersive (chat 1-à-1 + audio/vidéo) sont « le même
 * moteur de communication » (cahier des charges). On les réunit ici sous un seul shell à
 * onglets, monté à l'identique partout (élève, admin, secrétaire) via `forumBasePath`.
 * Le `MessagingProvider` est global (App.jsx) → la messagerie marche dans cet onglet.
 *
 * Hauteur : conteneur flex plein écran (moins la barre du dashboard) ; chaque onglet remplit
 * la zone restante. La messagerie a besoin d'une hauteur fixe (composer ancré en bas) ; le
 * forum scrolle dans la zone. Onglet inactif démonté (évite le polling messagerie en fond).
 */
export default function CommunicationShell({ forumBasePath = '/student-school-life/forum' }) {
  // Onglet initial pilotable par l'URL (?ctab=messagerie) — utilisé par le bouton « Discuter »
  // du forum pour ouvrir directement la conversation (la messagerie lit ?to= au montage).
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('ctab') === 'messagerie' ? 'messagerie' : 'forum');

  const TabButton = ({ value, label, Icon }) => {
    const active = tab === value;
    return (
      <button
        type="button"
        onClick={() => setTab(value)}
        aria-pressed={active}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '9px 18px', borderRadius: 11, cursor: 'pointer',
          fontSize: 13.5, fontWeight: 700, letterSpacing: '-0.01em',
          color: active ? '#0b0b0f' : '#D4AF37',
          background: active ? '#D4AF37' : 'rgba(212,175,55,0.10)',
          border: `1px solid ${active ? '#D4AF37' : 'rgba(212,175,55,0.28)'}`,
          transition: 'background 160ms ease, color 160ms ease',
        }}
      >
        <Icon size={15} strokeWidth={2.2} /> {label}
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 96px)', minHeight: 520 }}>
      {/* Sélecteur d'onglet (Forum / Messagerie) */}
      <div style={{ display: 'flex', gap: 10, padding: '2px 0 14px', flexShrink: 0 }}>
        <TabButton value="forum" label="Forum" Icon={MessageCircle} />
        <TabButton value="messagerie" label="Messagerie" Icon={MessagesSquare} />
      </div>

      {/* Contenu de l'onglet actif */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
        {tab === 'forum' ? (
          <div style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
            <StudentForumRedesign forumBasePath={forumBasePath} />
          </div>
        ) : (
          <div style={{ height: '100%', overflow: 'hidden' }}>
            <MessagingPage />
          </div>
        )}
      </div>
    </div>
  );
}
