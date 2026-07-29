import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Download, Loader2, Scissors, AlertTriangle } from 'lucide-react';
import { videothequeApi } from '@/lib/api-v2';

// Palette LIRI (alignée sur /liri et sur la Vidéothèque).
const C = {
  base: '#262624', panel: '#30302e', panel2: '#3a3a37', rail: '#1f1e1c',
  coral: '#d97757', ink: '#f5f4ee', muted: '#b0ada3', faint: '#82807a',
  line: 'rgba(245,244,238,.09)', coralTint: 'rgba(217,119,87,0.14)',
};
const SERIF = "'Source Serif 4', Georgia, serif";

/** mm:ss — un extrait dure des secondes, l'afficher en « 0 min » ne dirait rien. */
const mmss = (sec) => {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * LES EXTRAITS COURTS D'UN REPLAY, REGARDABLES SUR PLACE.
 *
 * Pourquoi ce panneau existe : le bouton « Voir les extraits » envoyait vers
 * `/studio/ad-creator`, un assistant de publication en trois étapes qui ne
 * connaissait ni le replay ni ses clips — on atterrissait à l'étape 1 devant un
 * formulaire vide. Le bouton promettait de MONTRER et il faisait NAVIGUER.
 *
 * Ici on répond à la question posée : voici les extraits, joue-les. La publication
 * reste un second geste, explicite, vers le Créateur de publicités.
 *
 * ⚠️ `preload="metadata"` et non `auto` : cinq clips verticaux préchargés en entier,
 * c'est plusieurs mégaoctets tirés de R2 à l'ouverture du panneau, pour des fichiers
 * que l'utilisateur va regarder un par un. On ne charge que la première image.
 */
export default function ExtraitsCourtsModal({ videoId, titreReplay, onClose, onPublier }) {
  const [etat, setEtat] = useState({ phase: 'chargement', clips: [], refus: [], message: '' });
  // Un seul extrait joue à la fois : cinq bandes-son simultanées sont
  // inécoutables, et c'est exactement ce que fait un clic sur le deuxième
  // lecteur si personne ne met le premier en pause.
  const lecteurs = useRef([]);

  useEffect(() => {
    let vivant = true;
    setEtat({ phase: 'chargement', clips: [], refus: [], message: '' });
    videothequeApi.listShorts(videoId)
      .then((r) => {
        if (!vivant) return;
        const clips = Array.isArray(r?.clips) ? r.clips : [];
        const refus = Array.isArray(r?.refus) ? r.refus : [];
        // ⚠️ « vide » ne veut pas dire « rien ne s'est passé ». Un replay peut n'avoir
        // AUCUN extrait publiable et POURTANT des refus à montrer — c'est même le cas
        // le plus instructif pour le créateur.
        setEtat({ phase: clips.length || refus.length ? 'pret' : 'vide', clips, refus, message: '' });
      })
      .catch((e) => {
        if (!vivant) return;
        const msg = String(e?.message || '');
        setEtat({
          phase: 'erreur',
          clips: [],
          refus: [],
          message: /403|forbidden/i.test(msg)
            ? "Réservé aux enseignants et responsables de l'école."
            : msg || 'Extraits illisibles.',
        });
      });
    return () => { vivant = false; };
  }, [videoId]);

  // Échap ferme. Sans ça, un panneau plein écran sans clavier est une impasse
  // pour qui ne vise pas la croix.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const auJeu = useCallback((i) => {
    lecteurs.current.forEach((el, j) => { if (el && j !== i && !el.paused) el.pause(); });
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Extraits courts de ${titreReplay || 'ce replay'}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        // ⚠️ 4100 ET PAS 90. Ce panneau s'ouvre DEPUIS le lecteur immersif, qui est
        // lui-même un plein écran à `zIndex: 4000` (ImmersiveVideoPlayer.jsx:349).
        // À 90 il se montait correctement — invisible, entièrement recouvert par le
        // lecteur. Symptôme trompeur : le bouton « ne fait rien », alors que l'état
        // et la requête étaient bons.
        position: 'fixed', inset: 0, zIndex: 4100,
        background: 'rgba(20,19,18,.86)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div style={{
        width: 'min(1180px, 100%)', maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        background: C.base, border: `1px solid ${C.line}`, borderRadius: 20, overflow: 'hidden',
      }}>
        {/* ── Coiffe ─────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
          padding: '18px 22px', borderBottom: `1px solid ${C.line}`, background: C.rail, flexShrink: 0,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.coral, fontSize: 11.5, fontWeight: 700, letterSpacing: '.04em' }}>
              <Scissors size={13} /> EXTRAITS COURTS
            </div>
            <h2 style={{
              fontFamily: SERIF, fontSize: 'clamp(18px,2.2vw,23px)', fontWeight: 600, margin: '5px 0 0',
              color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {titreReplay || 'Replay'}
            </h2>
            {etat.phase === 'pret' ? (
              <p style={{ color: C.muted, fontSize: 12.5, margin: '4px 0 0' }}>
                {/* ⚠️ « vertical » ne prend pas un `s` : il devient « verticaux ». Écrire
                    `vertical{n>1?'aux':''}` — ce que faisait la première version —
                    donnait « verticalaux » à l'écran. On remplace la FIN du mot. */}
                {etat.clips.length} extrait{etat.clips.length > 1 ? 's' : ''}{' '}
                vertic{etat.clips.length > 1 ? 'aux' : 'al'} · format 1080×1920, sous-titres incrustés
                {etat.refus.length ? ` · ${etat.refus.length} passage${etat.refus.length > 1 ? 's' : ''} écarté${etat.refus.length > 1 ? 's' : ''}` : ''}
              </p>
            ) : null}
          </div>
          <button
            type="button" onClick={onClose} aria-label="Fermer"
            style={{
              flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 34, height: 34, borderRadius: 999, border: `1px solid ${C.line}`,
              background: 'rgba(255,255,255,.05)', color: C.ink, cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Corps ──────────────────────────────────────────────────────── */}
        <div style={{ overflowY: 'auto', padding: 22, flex: 1 }}>
          {etat.phase === 'chargement' ? (
            <p style={{ color: C.faint, textAlign: 'center', padding: '50px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
              <Loader2 size={16} className="animate-spin" /> Chargement des extraits…
            </p>
          ) : etat.phase === 'erreur' ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: '#f6b8ab' }}>
              <AlertTriangle size={26} style={{ marginBottom: 10 }} />
              <p style={{ fontSize: 14 }}>{etat.message}</p>
            </div>
          ) : etat.phase === 'vide' ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: C.muted }}>
              <Scissors size={26} style={{ color: C.faint, marginBottom: 10 }} />
              <p style={{ fontSize: 14.5 }}>Aucun extrait prêt pour ce replay.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(212px, 1fr))', gap: 18 }}>
              {etat.clips.map((c, i) => (
                <article key={c.id} style={{ minWidth: 0 }}>
                  <div style={{
                    position: 'relative', aspectRatio: '9/16', borderRadius: 14, overflow: 'hidden',
                    background: C.rail, border: `1px solid ${C.line}`,
                  }}>
                    {c.url ? (
                      <video
                        ref={(el) => { lecteurs.current[i] = el; }}
                        src={c.url}
                        controls
                        playsInline
                        preload="metadata"
                        onPlay={() => auJeu(i)}
                        style={{ width: '100%', height: '100%', objectFit: 'contain', background: C.base, display: 'block' }}
                      />
                    ) : (
                      // La présignature R2 a échoué : on le DIT. Un lecteur muet sur
                      // un 403 ressemble à un extrait raté, alors que le fichier est
                      // là et que c'est l'accès qui manque.
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.faint, padding: 16, textAlign: 'center' }}>
                        <AlertTriangle size={20} />
                        <span style={{ fontSize: 12 }}>Fichier momentanément inaccessible</span>
                      </div>
                    )}
                  </div>

                  <h3 style={{
                    fontSize: 13.5, fontWeight: 600, lineHeight: 1.35, margin: '10px 0 0', color: C.ink,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {c.titre || `Extrait ${i + 1}`}
                  </h3>
                  <p style={{ fontSize: 11.5, color: C.faint, margin: '4px 0 0' }}>
                    {mmss(c.duree_sec)}
                    {Number.isFinite(c.debut_sec) ? ` · à ${mmss(c.debut_sec)} du replay` : ''}
                  </p>

                  {c.url_telechargement || c.url ? (
                    <a
                      // ⚠️ PAS `c.url` + `download`. L'attribut `download` est ignoré
                      // sur une cible d'un AUTRE domaine — et R2 en est un : le clic
                      // aurait ouvert la vidéo dans un onglet au lieu de
                      // l'enregistrer. C'est le serveur qui impose le
                      // téléchargement, via un `Content-Disposition: attachment`
                      // demandé dans l'URL présignée (`url_telechargement`).
                      href={c.url_telechargement || c.url}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8,
                        fontSize: 11.5, fontWeight: 700, color: C.muted, textDecoration: 'none',
                        padding: '5px 10px', borderRadius: 999, border: `1px solid ${C.line}`,
                        background: 'rgba(255,255,255,.05)',
                      }}
                    >
                      <Download size={12} /> Télécharger
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          )}

          {/* ── CE QUI A ÉTÉ ÉCARTÉ, ET POURQUOI ────────────────────────────
              ⭐ Un refus muet est un refus qu'on ne peut pas corriger. Le moteur
              écarte désormais des passages plutôt que de livrer du bavardage de
              fin de séance ou un titre que le clip ne tient pas ; sans cette
              liste, le créateur verrait « 2 extraits » là où il en attendait 5,
              sans savoir pourquoi ni pouvoir contester. */}
          {etat.phase === 'pret' && etat.refus.length > 0 ? (
            <div style={{ marginTop: etat.clips.length ? 28 : 0 }}>
              <h3 style={{
                fontSize: 12, fontWeight: 700, letterSpacing: '.04em', color: C.muted,
                margin: '0 0 4px', textTransform: 'uppercase',
              }}>
                Écarté au contrôle de sortie
              </h3>
              <p style={{ color: C.faint, fontSize: 12, margin: '0 0 12px', maxWidth: 720 }}>
                Ces passages ont été trouvés puis refusés : un mauvais extrait publié coûte
                plus cher qu'un extrait retenu. Si tu n'es pas d'accord, le motif te dit
                exactement quoi corriger — la fin du passage, le titre, ou le vocabulaire de l'école.
              </p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
                {etat.refus.map((r, i) => (
                  <li key={`${r.debut_sec}-${i}`} style={{
                    border: `1px solid ${C.line}`, borderRadius: 12, padding: '11px 14px',
                    background: 'rgba(255,255,255,.03)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 10.5, fontWeight: 700, letterSpacing: '.03em', color: '#f0c3ac',
                        border: `1px solid ${C.coral}`, background: C.coralTint,
                        padding: '2px 7px', borderRadius: 999,
                      }}>
                        {r.code}
                      </span>
                      <span style={{ fontSize: 13, color: C.ink, fontWeight: 600 }}>
                        {r.titre || 'Sans titre'}
                      </span>
                      <span style={{ fontSize: 11.5, color: C.faint }}>
                        à {mmss(r.debut_sec)} du replay
                      </span>
                    </div>
                    <p style={{ fontSize: 12.5, color: C.muted, margin: '6px 0 0', lineHeight: 1.45 }}>
                      {r.motif}
                    </p>
                    {r.extrait_texte ? (
                      <p style={{
                        fontSize: 11.5, color: C.faint, margin: '6px 0 0', lineHeight: 1.45,
                        fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        « {r.extrait_texte} »
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* ── Pied : la publication reste un geste explicite ──────────────── */}
        {etat.phase === 'pret' ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap',
            padding: '14px 22px', borderTop: `1px solid ${C.line}`, background: C.rail, flexShrink: 0,
          }}>
            <span style={{ color: C.faint, fontSize: 12 }}>
              Rien n'est publié tant que tu ne l'as pas demandé.
            </span>
            <button
              type="button" onClick={onPublier}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 999,
                border: `1px solid ${C.coral}`, background: C.coral, color: '#1f1e1c',
                cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
              }}
            >
              Publier sur les canaux
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
