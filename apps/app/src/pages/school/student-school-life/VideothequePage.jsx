import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Search, Film, GraduationCap, FileText, Loader2 } from 'lucide-react';
import { apiV2, masterclassApi, tenantsApi } from '@/lib/api-v2';
import { exportCoursePdf } from '@/lib/exportCoursePdf';
import ImmersiveVideoPlayer from '@/components/school/formations/ImmersiveVideoPlayer';

// Palette LIRI (alignée sur /liri).
const C = {
  base: '#262624', panel: '#30302e', panel2: '#3a3a37', rail: '#1f1e1c',
  coral: '#d97757', ink: '#f5f4ee', muted: '#b0ada3', faint: '#82807a',
  line: 'rgba(245,244,238,.09)', coralTint: 'rgba(217,119,87,0.14)',
};
const SERIF = "'Source Serif 4', Georgia, serif";

const fmtDur = (sec) => {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
};

/**
 * VIDÉOTHÈQUE ÉLÈVE — les enregistrements (Zoom → R2, table `published_videos`) publiés pour le
 * tenant, visibles par les élèves du parcours. Lit `GET /zoom-engine/published` (tenant-scopé).
 * Clic → lecteur (playback_url) + description + (transcription quand disponible).
 */
export default function VideothequePage() {
  const navigate = useNavigate();
  const [videos, setVideos] = useState(null); // null = chargement
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [active, setActive] = useState(null); // vidéo en lecture

  // ── Extraction du cours écrit (transcription → PDF structuré) ────────────
  // Réservé aux créateurs : l'analyse consomme des jetons IA (l'API renvoie 403
  // aux élèves de toute façon — on masque simplement le bouton pour eux).
  //
  // ⚠️ Le rôle NE VIT PAS dans la session Supabase (`user_metadata.role` est null
  // même pour l'owner) : il vit dans la MEMBERSHIP TENANT, côté serveur. On le
  // lit donc via /tenants/current (`userRole`), sinon le bouton restait masqué
  // pour tout le monde, y compris le propriétaire de l'école.
  //
  // ⚠️ DOUBLE ENVELOPPE : /tenants/current répond {data:{data:{…}}} alors que
  // `unwrap` n'en retire qu'une. On déballe donc une couche de plus si besoin.
  const [canExtract, setCanExtract] = useState(false);
  useEffect(() => {
    let alive = true;
    tenantsApi.current()
      .then((res) => {
        const t = res?.userRole || res?.role ? res : (res?.data ?? res);
        const r = String(t?.userRole || t?.role || '').toLowerCase();
        if (alive) setCanExtract(['owner', 'admin', 'teacher', 'creator'].includes(r));
      })
      .catch(() => { /* rôle inconnu → bouton masqué (le serveur reste seul juge) */ });
    return () => { alive = false; };
  }, []);
  const [extract, setExtract] = useState({ state: 'idle', message: '' });

  async function handleExtractCourse(video) {
    if (!video?.id) return;
    setExtract({ state: 'working', message: 'Analyse de la transcription…' });
    try {
      const course = await masterclassApi.fromReplay(video.id);
      if (!course?.modules?.length) throw new Error('Aucun contenu exploitable extrait.');
      setExtract({ state: 'working', message: 'Mise en page du document…' });
      await exportCoursePdf(course, { schoolName: 'Prorascience' });
      const nbL = course.modules.reduce((a, m) => a + (m.lessons?.length || 0), 0);
      setExtract({ state: 'done', message: `Cours généré : ${course.modules.length} module(s), ${nbL} leçon(s).` });
      setTimeout(() => setExtract({ state: 'idle', message: '' }), 6000);
    } catch (e) {
      const msg = String(e?.message || '');
      setExtract({
        state: 'error',
        message: /403|forbidden/i.test(msg)
          ? "Réservé aux enseignants et responsables de l'école."
          : /transcription/i.test(msg)
            ? msg
            : msg || 'Extraction impossible.',
      });
      setTimeout(() => setExtract({ state: 'idle', message: '' }), 9000);
    }
  }

  useEffect(() => {
    let alive = true;
    apiV2.get('/zoom-engine/published')
      .then((r) => { if (alive) setVideos(Array.isArray(r?.data?.data) ? r.data.data : (Array.isArray(r?.data) ? r.data : [])); })
      .catch((e) => { if (alive) { setVideos([]); setError(e?.message || 'Chargement impossible.'); } });
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const list = Array.isArray(videos) ? videos : [];
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter((v) => String(v.title || '').toLowerCase().includes(term) || String(v.description || '').toLowerCase().includes(term));
  }, [videos, q]);

  return (
    <div style={{ minHeight: 'calc(100vh - 120px)', background: C.base, color: C.ink, fontFamily: "'Inter', system-ui, sans-serif", padding: '18px 20px 48px' }}>
      {/* Lecteur immersif plein-écran */}
      {active && (
        <ImmersiveVideoPlayer
          src={active.playback_url}
          title={active.title}
          description={active.description}
          crumb={{ module: active.category }}
          cues={Array.isArray(active.transcript_cues) ? active.transcript_cues : undefined}
          transcript={active.transcript_text || active.transcript}
          onExit={() => setActive(null)}
          headerAction={(
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {/* Message d'état de l'extraction (analyse longue → on informe) */}
              {extract.state !== 'idle' && (
                <span style={{
                  fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', padding: '6px 10px', borderRadius: 999,
                  color: extract.state === 'error' ? '#f6b8ab' : extract.state === 'done' ? '#c9dcbf' : C.muted,
                  background: extract.state === 'error' ? 'rgba(217,119,87,.14)' : extract.state === 'done' ? 'rgba(159,191,143,.14)' : 'rgba(255,255,255,.05)',
                }}>
                  {extract.message}
                </span>
              )}
              {canExtract && (
                <button
                  type="button"
                  onClick={() => handleExtractCourse(active)}
                  disabled={extract.state === 'working'}
                  title="Transformer la transcription de ce direct en document de cours structuré (PDF)"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999,
                    border: `1px solid ${C.line}`, background: 'rgba(255,255,255,.05)', color: C.ink,
                    cursor: extract.state === 'working' ? 'wait' : 'pointer', fontSize: 12.5, fontWeight: 700,
                    whiteSpace: 'nowrap', opacity: extract.state === 'working' ? 0.7 : 1,
                  }}
                >
                  {extract.state === 'working'
                    ? <Loader2 size={14} className="animate-spin" />
                    : <FileText size={14} />}
                  {extract.state === 'working' ? 'Extraction…' : 'Extraire le cours (PDF)'}
                </button>
              )}
              {active.precepteur_id ? (
                <button type="button" onClick={() => navigate(`/liri/precepteur/cours/${active.precepteur_id}`)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999, border: `1px solid ${C.coral}`, background: C.coralTint, color: '#f0c3ac', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  <GraduationCap size={14} /> Suivre le cours
                </button>
              ) : null}
            </div>
          )}
        />
      )}

      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(24px,3vw,32px)', fontWeight: 600, margin: 0 }}>Vidéothèque</h1>
            <p style={{ color: C.muted, fontSize: 13.5, margin: '4px 0 0' }}>Revois les sessions de cours enregistrées, quand tu veux.</p>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: 11, color: C.faint }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…"
              style={{ paddingLeft: 34, paddingRight: 14, height: 38, borderRadius: 12, border: `1px solid ${C.line}`, background: C.panel, color: C.ink, fontSize: 13.5, outline: 'none', width: 240 }} />
          </div>
        </div>

        {videos === null ? (
          <p style={{ color: C.faint, textAlign: 'center', padding: '60px 0' }}>Chargement…</p>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted }}>
            <Film size={30} style={{ color: C.faint, marginBottom: 10 }} />
            <p style={{ fontSize: 15 }}>{q ? 'Aucun résultat.' : 'Aucun enregistrement publié pour le moment.'}</p>
            {error ? <p style={{ fontSize: 12.5, color: C.faint, marginTop: 6 }}>{error}</p> : null}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {filtered.map((v) => (
              <button key={v.id} type="button" onClick={() => setActive(v)}
                style={{ textAlign: 'left', padding: 0, borderRadius: 16, overflow: 'hidden', border: `1px solid ${C.line}`, background: C.panel, cursor: 'pointer', color: C.ink }}>
                <div style={{ position: 'relative', aspectRatio: '16/9', background: C.panel2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {v.thumbnail_url ? <img src={v.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Film size={26} style={{ color: C.faint }} />}
                  <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.18)' }}>
                    <span style={{ width: 44, height: 44, borderRadius: 22, background: C.coralTint, border: `1px solid ${C.coral}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Play size={18} style={{ color: C.coral, marginLeft: 2 }} />
                    </span>
                  </span>
                  {v.duration_sec ? <span style={{ position: 'absolute', right: 8, bottom: 8, fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: 'rgba(0,0,0,.6)', color: '#fff' }}>{fmtDur(v.duration_sec)}</span> : null}
                  {v.precepteur_id ? <span style={{ position: 'absolute', left: 8, top: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: 'rgba(217,119,87,.92)', color: '#fff' }}><GraduationCap size={11} /> Cours</span> : null}
                </div>
                <div style={{ padding: '11px 13px 14px' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{v.title || 'Cours enregistré'}</div>
                  {v.category ? <div style={{ fontSize: 11.5, color: C.faint, marginTop: 5 }}>{v.category}</div> : null}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
