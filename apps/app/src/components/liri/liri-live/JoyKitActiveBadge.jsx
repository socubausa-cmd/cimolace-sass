import React, { useEffect, useState } from 'react';

const LEVEL_FR = {
  light: 'Léger',
  interactive: 'Interactif',
  control: 'Contrôle',
  full: 'Complet',
};

function formatLine(grant) {
  if (!grant?.level) return null;
  const label = LEVEL_FR[grant.level] || grant.level;
  if (grant.scope === 'temporary' && grant.expiresAt != null) {
    const sec = Math.max(0, Math.floor((grant.expiresAt - Date.now()) / 1000));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${label} · ${m}:${String(s).padStart(2, '0')}`;
  }
  return `${label} · session`;
}

/**
 * @param {{ grant: { level: string, expiresAt: number|null, scope: string }|null|undefined }} props
 */
export default function JoyKitActiveBadge({ grant }) {
  const [line, setLine] = useState(() => formatLine(grant));

  useEffect(() => {
    setLine(formatLine(grant));
    if (!grant?.level) return undefined;
    if (grant.scope !== 'temporary' || grant.expiresAt == null) return undefined;
    const id = window.setInterval(() => {
      setLine(formatLine(grant));
    }, 1000);
    return () => window.clearInterval(id);
  }, [grant]);

  if (!line) return null;

  return (
    <span
      title="JoyKit actif (accord formateur)"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        borderRadius: 6,
        border: '1px solid rgba(200,150,12,.45)',
        background: 'rgba(200,150,12,.14)',
        padding: '4px 8px',
        fontSize: 9,
        fontWeight: 800,
        color: '#fbbf24',
        letterSpacing: '.04em',
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fbbf24', boxShadow: '0 0 6px rgba(251,191,36,.6)' }} />
      JoyKit · {line}
    </span>
  );
}
