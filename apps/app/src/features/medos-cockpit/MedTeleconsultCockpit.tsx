// ─────────────────────────────────────────────────────────────────────────────
// Cockpit clinique de téléconsultation — jumeau 3D + bilan + note SOAP,
// partageables NATIVEMENT au patient pendant l'appel vidéo LIRI.
//
//   mode='host'    → praticien : charge le dossier, navigue, PARTAGE une vue.
//   mode='patient' → patient   : reçoit et affiche la vue partagée (passif).
//
// 100 % auto-contenu : un seul montage dans la salle live suffit. Le composant
// gère son propre lanceur (FAB), son chargement, et le canal de partage.
// Palette CSS (--zw-*) scoppée à la racine du cockpit → les composants portés
// du jumeau rendent correctement sans toucher le thème de l'app.
// ─────────────────────────────────────────────────────────────────────────────
import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  buildOrganNodes,
  getClinicalContext,
  getLatestSoap,
  getReferential,
  getTwinState,
  getLabs,
  getSignedPrescriptions,
  getAttachments,
  getAttachmentUrl,
  COLOR_HEX,
  COLOR_LABEL,
  WHEEL_LABELS,
  type ClinicalContext,
  type CockpitScene,
  type OrganColor,
  type OrganNode,
  type SoapNote,
  type WheelDomain,
  type LabResult,
  type RxDoc,
  type AttachmentLite,
} from './cockpit-api';
import { useCockpitChannel } from './useCockpitChannel';

const BodyViewer3D = lazy(() =>
  import('./BodyViewer3D').then((m) => ({ default: m.BodyViewer3D })),
);

const COCKPIT_VARS = {
  '--zw-text': '#2b2420',
  '--zw-text-soft': '#5b5048',
  '--zw-text-muted': '#857a6d',
  '--zw-text-faint': '#b3a795',
  '--zw-border': '#e6ded2',
  '--zw-border-strong': '#cdbfa8',
  '--zw-bg-subtle': '#f4efe6',
  '--brand-primary': '#b08d57',
} as React.CSSProperties;

const Z = 2147483000; // au-dessus du shell live

type Tab = 'twin' | 'wheel' | 'soap' | 'labs' | 'rx' | 'image';

// ── Sous-vues (partagées host/patient) ──────────────────────────────────────

function TwinView({
  organs,
  sex,
  selected,
  onSelect,
}: {
  organs: OrganNode[];
  sex: 'female' | 'male';
  selected: string | null;
  onSelect: (code: string) => void;
}) {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: 360 }}>
      <Suspense
        fallback={
          <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--zw-text-faint)', fontSize: 13 }}>
            Chargement du jumeau 3D…
          </div>
        }
      >
        <BodyViewer3D organs={organs} selected={selected} onSelect={onSelect} sex={sex} />
      </Suspense>
    </div>
  );
}

function WheelView({
  domains,
  organs,
}: {
  domains: WheelDomain[];
  organs: Array<{ code: string; name_fr: string; score: { score: number; color: OrganColor } | null }>;
}) {
  const colorForScore = (s: number): OrganColor =>
    s >= 75 ? 'green' : s >= 55 ? 'yellow' : s >= 35 ? 'orange' : 'red';
  const scored = organs.filter((o) => o.score).sort((a, b) => (a.score!.score - b.score!.score));
  return (
    <div style={{ padding: '4px 2px', overflowY: 'auto', height: '100%' }}>
      {domains && domains.length > 0 && (
        <>
          <div style={sectionTitle}>Roue de transformation</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16 }}>
            {domains.map((d) => {
              const c = COLOR_HEX[colorForScore(d.score)];
              return (
                <div key={d.domain} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 116, fontSize: 12, color: 'var(--zw-text-soft)', flexShrink: 0 }}>
                    {WHEEL_LABELS[d.domain] || d.domain}
                  </span>
                  <span style={{ flex: 1, height: 9, borderRadius: 999, background: 'var(--zw-bg-subtle)', overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${Math.max(3, Math.min(100, d.score))}%`, background: c, borderRadius: 999 }} />
                  </span>
                  <span style={{ width: 30, textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'var(--zw-text)' }}>{Math.round(d.score)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
      {scored.length > 0 && (
        <>
          <div style={sectionTitle}>Scores d'organes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {scored.map((o) => (
              <div key={o.code} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: COLOR_HEX[o.score!.color], flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--zw-text)' }}>{o.name_fr}</span>
                <span style={{ fontSize: 12, color: 'var(--zw-text-muted)' }}>{COLOR_LABEL[o.score!.color]}</span>
                <span style={{ width: 34, textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--zw-text)' }}>{o.score!.score}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {(!domains || domains.length === 0) && scored.length === 0 && (
        <div style={emptyHint}>Aucun bilan disponible pour ce patient.</div>
      )}
    </div>
  );
}

function SoapView({ soap }: { soap: SoapNote | null }) {
  if (!soap) return <div style={emptyHint}>Aucune note de consultation pour ce patient.</div>;
  const blocks: Array<[string, string | null]> = [
    ['S — Subjectif', soap.subjective],
    ['O — Objectif', soap.objective],
    ['A — Analyse', soap.assessment],
    ['P — Plan', soap.plan],
  ];
  return (
    <div style={{ padding: '2px 2px', overflowY: 'auto', height: '100%' }}>
      <div style={{ fontSize: 11, color: 'var(--zw-text-muted)', background: 'var(--zw-bg-subtle)', border: '1px solid var(--zw-border)', borderRadius: 8, padding: '6px 9px', marginBottom: 10 }}>
        Synthèse clinique partagée par votre praticien. Ne constitue pas un diagnostic.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {blocks.map(([label, val]) => (
          <div key={label}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--brand-primary)', letterSpacing: 0.3, marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: val ? 'var(--zw-text)' : 'var(--zw-text-faint)', whiteSpace: 'pre-wrap' }}>
              {val || '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LabsView({ items }: { items: LabResult[] }) {
  if (!items || items.length === 0) return <div style={emptyHint}>Aucun bilan biologique disponible.</div>;
  const labName = (l: LabResult) => l.test_name || l.name || l.label || l.code || 'Analyse';
  const labDate = (l: LabResult) => String(l.result_date || l.date || l.created_at || '').slice(0, 10);
  return (
    <div style={{ padding: '8px 12px', overflowY: 'auto', height: '100%' }}>
      <div style={sectionTitle}>Bilans biologiques</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((l, i) => (
          <div key={l.id || i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--zw-border)' }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--zw-text)' }}>{labName(l)}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: l.flag ? '#f97316' : 'var(--zw-text)' }}>
              {l.value ?? '—'}{l.unit ? ` ${l.unit}` : ''}
            </span>
            {l.reference_range ? <span style={{ fontSize: 11, color: 'var(--zw-text-muted)' }}>réf. {l.reference_range}</span> : null}
            {labDate(l) ? <span style={{ fontSize: 11, color: 'var(--zw-text-faint)', width: 74, textAlign: 'right' }}>{labDate(l)}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function PrescriptionView({ rx }: { rx: RxDoc | null }) {
  if (!rx) return <div style={emptyHint}>Aucune ordonnance signée.</div>;
  return (
    <div style={{ padding: '8px 12px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <span style={sectionTitle}>Ordonnance</span>
        {rx.prescription_number ? <span style={{ fontSize: 11, color: 'var(--zw-text-muted)' }}>n° {rx.prescription_number}</span> : null}
        {rx.issued_at ? <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--zw-text-faint)' }}>{String(rx.issued_at).slice(0, 10)}</span> : null}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(rx.items || []).map((it, i) => (
          <div key={i} style={{ borderLeft: '3px solid var(--brand-primary)', paddingLeft: 10 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--zw-text)' }}>{it.drug_name}</div>
            <div style={{ fontSize: 12, color: 'var(--zw-text-soft)', lineHeight: 1.5 }}>
              {[it.dosage, it.frequency, it.duration].filter(Boolean).join(' · ')}
              {it.route ? ` — ${it.route}` : ''}
            </div>
            {it.notes ? <div style={{ fontSize: 11.5, color: 'var(--zw-text-muted)', fontStyle: 'italic' }}>{it.notes}</div> : null}
          </div>
        ))}
      </div>
      {rx.patient_instructions ? (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--zw-text-soft)', background: 'var(--zw-bg-subtle)', borderRadius: 8, padding: '8px 10px' }}>
          {rx.patient_instructions}
        </div>
      ) : null}
    </div>
  );
}

function ImageView({ url, name, mime }: { url: string; name: string; mime?: string }) {
  const isPdf = (mime || '').includes('pdf') || /\.pdf($|\?)/i.test(url);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 8 }}>
      <div style={{ fontSize: 12, color: 'var(--zw-text-muted)', marginBottom: 6, flexShrink: 0 }}>{name}</div>
      <div style={{ flex: 1, minHeight: 0, background: 'var(--zw-bg-subtle)', borderRadius: 10, overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
        {!url ? (
          <span style={{ color: 'var(--zw-text-faint)', fontSize: 13 }}>Chargement…</span>
        ) : isPdf ? (
          <iframe title={name} src={url} style={{ width: '100%', height: '100%', border: 'none' }} />
        ) : (
          <img src={url} alt={name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        )}
      </div>
    </div>
  );
}

// Onglet IMAGERIE côté composer : liste des pièces jointes → on en choisit une
// (URL signée récupérée) → aperçu, puis « Partager » l'envoie sur la scène.
function ImageTab({
  attachments,
  selectedImg,
  onPick,
  onBack,
}: {
  attachments: AttachmentLite[];
  selectedImg: { url: string; name: string; mime?: string } | null;
  onPick: (a: AttachmentLite) => void;
  onBack: () => void;
}) {
  if (selectedImg) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <button onClick={onBack} style={{ alignSelf: 'flex-start', margin: '4px 0 6px', padding: '4px 9px', fontSize: 11.5, border: '1px solid var(--zw-border-strong)', borderRadius: 7, background: 'transparent', color: 'var(--zw-text-soft)', cursor: 'pointer' }}>
          ← Pièces jointes
        </button>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ImageView url={selectedImg.url} name={selectedImg.name} mime={selectedImg.mime} />
        </div>
      </div>
    );
  }
  if (!attachments || attachments.length === 0) return <div style={emptyHint}>Aucune pièce jointe (imagerie, scan, PDF).</div>;
  return (
    <div style={{ padding: '8px 12px', overflowY: 'auto', height: '100%' }}>
      <div style={sectionTitle}>Pièces jointes</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {attachments.map((a) => (
          <button key={a.id} onClick={() => onPick(a)} style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', padding: '8px 9px', borderRadius: 8, border: '1px solid var(--zw-border)', background: '#fff', cursor: 'pointer', fontSize: 13, color: 'var(--zw-text)' }}>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.file_name}</span>
            <span style={{ fontSize: 11, color: 'var(--brand-primary)', fontWeight: 700, flexShrink: 0 }}>Choisir</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Rendu d'une scène clinique partagée — réutilisé par le cockpit patient ET la
// SCÈNE CENTRALE de la salle Consultation. Wrappé dans les vars --zw-* pour que
// les composants portés (jumeau, roue, SOAP, labs, ordonnance, imagerie) rendent.
export function SharedSceneView({ scene }: { scene: CockpitScene | null }) {
  if (!scene || scene.kind === 'clear') return null;
  return (
    <div style={{ ...COCKPIT_VARS, width: '100%', height: '100%' }}>
      {scene.kind === 'twin' && (
        <TwinView organs={scene.organs} sex={scene.sex} selected={scene.focus} onSelect={() => {}} />
      )}
      {scene.kind === 'wheel' && <WheelView domains={scene.domains} organs={scene.organs} />}
      {scene.kind === 'soap' && <SoapView soap={scene.soap} />}
      {scene.kind === 'labs' && <LabsView items={scene.items} />}
      {scene.kind === 'prescription' && <PrescriptionView rx={scene.rx} />}
      {scene.kind === 'image' && <ImageView url={scene.url} name={scene.name} mime={scene.mime} />}
    </div>
  );
}

// ── Vue PATIENT (passive : rend la scène partagée) ──────────────────────────

function PatientCockpit({ channel }: { channel: CockpitChannel }) {
  const { scene } = channel;
  const [open, setOpen] = useState(true);

  const hasScene = scene && scene.kind !== 'clear';
  useEffect(() => {
    if (hasScene) setOpen(true);
  }, [hasScene, scene?.kind]);

  if (!hasScene) return null;
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={fabStyle} title="Voir le partage du praticien">
        🩺
      </button>
    );
  }

  return (
    <div style={{ ...panelStyle, ...COCKPIT_VARS }}>
      <div style={headerStyle}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Partagé par votre praticien</span>
        <button onClick={() => setOpen(false)} style={closeBtn} title="Réduire">—</button>
      </div>
      <div style={bodyStyle}>
        <SharedSceneView scene={scene!} />
      </div>
    </div>
  );
}

// ── Vue HOST (praticien : charge, navigue, partage) ─────────────────────────

function HostCockpit({ sessionId, channel }: { sessionId: string; channel: CockpitChannel }) {
  const { scene: sharedScene, shareScene, clearScene } = channel;
  const [open, setOpen] = useState(false);
  const [ctx, setCtx] = useState<ClinicalContext | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [tab, setTab] = useState<Tab>('twin');
  const [organs, setOrgans] = useState<OrganNode[]>([]);
  const [wheel, setWheel] = useState<WheelDomain[]>([]);
  const [soap, setSoap] = useState<SoapNote | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [labs, setLabs] = useState<LabResult[]>([]);
  const [prescriptions, setPrescriptions] = useState<RxDoc[]>([]);
  const [attachments, setAttachments] = useState<AttachmentLite[]>([]);
  const [selectedImg, setSelectedImg] = useState<{ url: string; name: string; mime?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Charge le contexte + le dossier (jumeau, bilan, SOAP). Si la session n'est
  // pas une téléconsult (404) ou accès refusé → on n'affiche rien (pas de FAB).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const c = await getClinicalContext(sessionId);
        if (!alive) return;
        setCtx(c);
        const [refs, state] = await Promise.all([
          getReferential().catch(() => ({ organs: [], biomarkers: [] })),
          getTwinState(c.patient_id).catch(() => ({ organs: [], biomarkers: [], wheel: null })),
        ]);
        if (!alive) return;
        setOrgans(buildOrganNodes(refs, state));
        setWheel(state?.wheel?.domains || []);
        getLatestSoap(c.patient_id).then((s) => alive && setSoap(s)).catch(() => {});
        getLabs(c.patient_id).then((r) => alive && setLabs(r)).catch(() => {});
        getSignedPrescriptions(c.patient_id).then((r) => alive && setPrescriptions(r)).catch(() => {});
        getAttachments(c.patient_id).then((r) => alive && setAttachments(r)).catch(() => {});
      } catch {
        if (alive) setLoadFailed(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [sessionId]);

  const organScores = useMemo(
    () => organs.map((o) => ({ code: o.code, name_fr: o.name_fr, score: o.score })),
    [organs],
  );

  const latestRx = prescriptions[0] || null;

  const shareCurrent = () => {
    if (tab === 'twin') shareScene({ kind: 'twin', sex: ctx?.sex || 'female', organs, focus: selected });
    else if (tab === 'wheel') shareScene({ kind: 'wheel', domains: wheel, organs: organScores });
    else if (tab === 'soap' && soap) shareScene({ kind: 'soap', soap });
    else if (tab === 'labs' && labs.length) shareScene({ kind: 'labs', items: labs });
    else if (tab === 'rx' && latestRx) shareScene({ kind: 'prescription', rx: latestRx });
    else if (tab === 'image' && selectedImg?.url) shareScene({ kind: 'image', url: selectedImg.url, name: selectedImg.name, mime: selectedImg.mime });
  };

  // Sélection d'une pièce jointe : on récupère l'URL signée puis on l'affiche en
  // aperçu ; « Partager » l'enverra ensuite sur la scène.
  const pickAttachment = async (a: AttachmentLite) => {
    setSelectedImg({ url: '', name: a.file_name, mime: a.mime_type || undefined });
    const url = await getAttachmentUrl(a.id);
    setSelectedImg({ url, name: a.file_name, mime: a.mime_type || undefined });
  };

  const canShare =
    tab === 'twin' ||
    tab === 'wheel' ||
    (tab === 'soap' && !!soap) ||
    (tab === 'labs' && labs.length > 0) ||
    (tab === 'rx' && !!latestRx) ||
    (tab === 'image' && !!selectedImg?.url);

  const isSharing = !!sharedScene && sharedScene.kind !== 'clear';
  const tabKind: Record<Tab, CockpitScene['kind']> = {
    twin: 'twin', wheel: 'wheel', soap: 'soap', labs: 'labs', rx: 'prescription', image: 'image',
  };
  const sharingThisTab = isSharing && sharedScene!.kind === tabKind[tab];

  if (loadFailed) return null; // session non-médicale → cockpit masqué

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={fabStyle} title="Dossier clinique du patient">
        🩺
        {isSharing && <span style={fabDot} />}
      </button>
    );
  }

  const tabs: Array<[Tab, string]> = [
    ['twin', 'Jumeau'],
    ['wheel', 'Roue'],
    ['labs', 'Bilans'],
    ['image', 'Imagerie'],
    ['rx', 'Ordonnance'],
    ['soap', 'SOAP'],
  ];

  return (
    <div style={{ ...panelStyle, ...COCKPIT_VARS }}>
      <div style={headerStyle}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {ctx?.patient_name || 'Dossier patient'}
        </span>
        <button onClick={() => setOpen(false)} style={closeBtn} title="Réduire">—</button>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 2, padding: '6px 6px 0', background: '#fff', borderBottom: '1px solid var(--zw-border)', overflowX: 'auto' }}>
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              flexShrink: 0, padding: '7px 9px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
              border: 'none', borderBottom: tab === key ? '2px solid var(--brand-primary)' : '2px solid transparent',
              background: 'transparent', color: tab === key ? 'var(--zw-text)' : 'var(--zw-text-muted)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={bodyStyle}>
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--zw-text-faint)', fontSize: 13 }}>
            Chargement du dossier…
          </div>
        ) : (
          <>
            {tab === 'twin' && (
              <TwinView organs={organs} sex={ctx?.sex || 'female'} selected={selected} onSelect={setSelected} />
            )}
            {tab === 'wheel' && <WheelView domains={wheel} organs={organScores} />}
            {tab === 'soap' && <SoapView soap={soap} />}
            {tab === 'labs' && <LabsView items={labs} />}
            {tab === 'rx' && <PrescriptionView rx={latestRx} />}
            {tab === 'image' && (
              <ImageTab attachments={attachments} selectedImg={selectedImg} onPick={pickAttachment} onBack={() => setSelectedImg(null)} />
            )}
          </>
        )}
      </div>

      {/* Barre de partage */}
      <div style={shareBar}>
        {sharingThisTab ? (
          <span style={{ fontSize: 11.5, color: '#22c55e', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} /> Partagé au patient
          </span>
        ) : (
          <span style={{ fontSize: 11.5, color: 'var(--zw-text-muted)' }}>
            {!canShare ? 'Rien à partager dans cet onglet' : "Cette vue n'est pas partagée"}
          </span>
        )}
        <span style={{ flex: 1 }} />
        {isSharing && (
          <button onClick={clearScene} style={{ ...shareActionBtn, background: 'transparent', color: 'var(--zw-text-soft)', border: '1px solid var(--zw-border-strong)' }}>
            Arrêter
          </button>
        )}
        <button
          onClick={shareCurrent}
          disabled={!canShare}
          style={{ ...shareActionBtn, opacity: canShare ? 1 : 0.5, cursor: canShare ? 'pointer' : 'not-allowed' }}
        >
          Partager au patient
        </button>
      </div>
    </div>
  );
}

// ── Point d'entrée ──────────────────────────────────────────────────────────

export type CockpitChannel = ReturnType<typeof useCockpitChannel>;

// Dock cockpit (FAB + panneau) piloté par un canal de partage FOURNI. Permet de
// PARTAGER le même canal entre le dock et la SCÈNE de la salle Consultation : un
// seul abonnement Realtime → le partage du praticien se reflète IMMÉDIATEMENT
// sur sa propre scène (pas de round-trip qui se perd avec broadcast self:false).
export function CockpitDock({
  sessionId,
  mode,
  channel,
}: {
  sessionId: string;
  mode: 'host' | 'patient';
  channel: CockpitChannel;
}) {
  return mode === 'host' ? (
    <HostCockpit sessionId={sessionId} channel={channel} />
  ) : (
    <PatientCockpit channel={channel} />
  );
}

export default function MedTeleconsultCockpit({
  sessionId,
  mode,
}: {
  sessionId: string | null | undefined;
  mode: 'host' | 'patient';
}) {
  const channel = useCockpitChannel(sessionId ?? null, mode);
  if (!sessionId) return null;
  return <CockpitDock sessionId={sessionId} mode={mode} channel={channel} />;
}

// ── Styles ──────────────────────────────────────────────────────────────────

const fabStyle: React.CSSProperties = {
  position: 'fixed', right: 18, bottom: 92, zIndex: Z, width: 52, height: 52, borderRadius: '50%',
  border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#b08d57,#8a6d3f)', color: '#fff',
  fontSize: 22, boxShadow: '0 6px 22px rgba(0,0,0,0.34)', display: 'grid', placeItems: 'center',
};
const fabDot: React.CSSProperties = {
  position: 'absolute', top: 4, right: 4, width: 12, height: 12, borderRadius: '50%',
  background: '#22c55e', border: '2px solid #fff',
};
const panelStyle: React.CSSProperties = {
  position: 'fixed', right: 18, bottom: 18, zIndex: Z, width: 'min(440px, calc(100vw - 36px))',
  height: 'min(76vh, 720px)', background: '#fff', borderRadius: 16, overflow: 'hidden',
  display: 'flex', flexDirection: 'column', boxShadow: '0 18px 60px rgba(0,0,0,0.42)',
  border: '1px solid rgba(0,0,0,0.12)',
};
const headerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px',
  background: 'linear-gradient(135deg,#2b2420,#1f1b18)',
};
const closeBtn: React.CSSProperties = {
  marginLeft: 'auto', width: 26, height: 26, borderRadius: 7, border: 'none', cursor: 'pointer',
  background: 'rgba(255,255,255,0.16)', color: '#fff', fontSize: 16, lineHeight: 1, flexShrink: 0,
};
const bodyStyle: React.CSSProperties = {
  flex: 1, minHeight: 0, padding: 12, background: '#fff', overflow: 'hidden',
};
const shareBar: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
  borderTop: '1px solid var(--zw-border)', background: 'var(--zw-bg-subtle)',
};
const shareActionBtn: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 12.5,
  fontWeight: 700, background: 'var(--brand-primary)', color: '#fff', flexShrink: 0,
};
const sectionTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--zw-text-muted)', textTransform: 'uppercase',
  letterSpacing: 0.5, margin: '4px 0 8px',
};
const emptyHint: React.CSSProperties = {
  display: 'grid', placeItems: 'center', height: '100%', color: 'var(--zw-text-faint)',
  fontSize: 13, textAlign: 'center', padding: 16,
};
