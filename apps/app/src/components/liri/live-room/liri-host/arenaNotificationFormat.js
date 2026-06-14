/**
 * Libellés naturels pour le journal hôte LIRI (évite textes bruts / techniques).
 * @param {{ text?: string, kind?: string, at?: number }} item
 */
export function formatArenaNotificationLine(item) {
  const kind = item?.kind || 'default';
  const raw = String(item?.text || '').trim();

  if (typeof kind === 'string' && kind.startsWith('longia_')) {
    const cat = kind.replace(/^longia_/, '');
    const prefix =
      cat === 'content'
        ? 'LONGIA — Contenu'
        : cat === 'pedagogy'
          ? 'LONGIA — Pédagogie'
          : cat === 'audience'
            ? 'LONGIA — Audience'
            : cat === 'chat'
              ? 'LONGIA — Chat'
              : cat === 'production'
                ? 'LONGIA — Production'
                : 'LONGIA';
    return raw ? `${prefix} : ${raw}` : prefix;
  }

  if (kind === 'join') {
    if (/vient de rejoindre le panel/i.test(raw)) return raw;
    const name = extractNameAfterJoin(raw);
    return `${name} vient de rejoindre le panel`;
  }
  if (kind === 'leave') {
    if (/vient de quitter le panel/i.test(raw)) return raw;
    const name = extractNameBeforeVerb(raw, ['a quitté', 'quitté', 'a quitté la session']);
    return `${name} vient de quitter le panel`;
  }
  if (kind === 'hand') {
    const name = extractNameBeforeVerb(raw, ['a levé']);
    return `${name} a levé la main`;
  }
  if (kind === 'waiting') {
    const mFile = raw.match(/^(.+?)\s+vient de rejoindre la file d'attente/i);
    if (mFile) return `${mFile[1].trim()} attend dans la salle d'attente`;
    const name = extractNameBeforeVerb(raw, ['est en salle', 'attend', 'vient de rejoindre']);
    return `${name} attend dans la salle d'attente`;
  }
  if (kind === 'promote') {
    if (raw.includes('antenne')) return raw;
    const name = extractNameBeforeVerb(raw, ['est']);
    return `${name} est à l'antenne`;
  }

  return polishLooseNotificationText(raw);
}

function extractNameAfterJoin(text) {
  const m = text.match(/^(.+?)\s+a rejoint/i);
  if (m) return m[1].trim();
  const m2 = text.match(/^(.+?)\s+vient de rejoindre/i);
  if (m2) return m2[1].trim();
  return text.replace(/\s+a rejoint.*$/i, '').trim() || 'Un membre';
}

function extractNameBeforeVerb(text, verbs) {
  let t = text;
  for (const v of verbs) {
    const idx = t.toLowerCase().indexOf(v);
    if (idx > 0) return t.slice(0, idx).trim();
  }
  return t.replace(/\s+est\s+.*$/i, '').trim() || 'Un membre';
}

function polishLooseNotificationText(text) {
  if (!text) return 'Événement';
  let t = text;
  t = t.replace(/\bquite\b/gi, 'quitte');
  t = t.replace(/\bquiter\b/gi, 'quitte');
  t = t.replace(/^(.+?)\s+quite\s+$/i, '$1 vient de quitter le panel');
  t = t.replace(/^(.+?)\s+join$/i, '$1 vient de rejoindre le panel');
  return t;
}

/** Durée relative courte (fr) */
export function formatRaisedHandSince(ts) {
  if (ts == null || Number.isNaN(Number(ts))) return '';
  const sec = Math.max(0, Math.floor((Date.now() - Number(ts)) / 1000));
  if (sec < 60) return `depuis ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `depuis ${min} min`;
  const h = Math.floor(min / 60);
  return `depuis ${h} h`;
}
