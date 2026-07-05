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
  type ShopProduct,
  type ShopBrand,
  getStorefront,
  generateSoapFromTranscript,
  type OrganColor,
  type OrganNode,
  type SoapNote,
  type WheelDomain,
  type LabResult,
  type RxDoc,
  type AttachmentLite,
} from './cockpit-api';
import { useCockpitChannel } from './useCockpitChannel';
import { MEDOS_STUDY_CASES, applyCaseOrganScores } from './medosStudyCases';
import { attachmentsApi, medosApi } from '@/lib/api';
import { useWebSpeechScribe } from '@/hooks/useWebSpeechScribe';

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

type Tab = 'twin' | 'wheel' | 'soap' | 'labs' | 'rx' | 'image' | 'shop';

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

const wheelColorForScore = (s: number): OrganColor =>
  s >= 75 ? 'green' : s >= 55 ? 'yellow' : s >= 35 ? 'orange' : 'red';

/** Vraie roue circulaire (radar) des domaines de transformation. */
function WheelRadar({ domains }: { domains: WheelDomain[] }) {
  const N = Math.max(1, domains.length);
  const cx = 170, cy = 172, R = 118;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N;
  const pt = (i: number, r: number) => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))] as const;
  const poly = domains
    .map((d, i) => pt(i, (Math.max(0, Math.min(100, d.score)) / 100) * R).join(','))
    .join(' ');
  return (
    <svg viewBox="0 0 340 344" style={{ width: '100%', maxWidth: 360, height: 'auto', margin: '0 auto', display: 'block' }}>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <circle key={f} cx={cx} cy={cy} r={R * f} fill="none" stroke="var(--zw-border)" strokeWidth={1} />
      ))}
      {domains.map((d, i) => {
        const [ax, ay] = pt(i, R);
        const [lx, ly] = pt(i, R + 18);
        const anchor = lx < cx - 6 ? 'end' : lx > cx + 6 ? 'start' : 'middle';
        return (
          <g key={d.domain}>
            <line x1={cx} y1={cy} x2={ax} y2={ay} stroke="var(--zw-border)" strokeWidth={1} />
            <text x={lx} y={ly} fontSize={10} fontWeight={600} fill="var(--zw-text-soft)" textAnchor={anchor} dominantBaseline="middle">
              {(WHEEL_LABELS[d.domain] || d.domain).slice(0, 15)}
            </text>
          </g>
        );
      })}
      <polygon points={poly} fill="var(--brand-primary)" fillOpacity={0.16} stroke="var(--brand-primary)" strokeWidth={2} strokeLinejoin="round" />
      {domains.map((d, i) => {
        const [px, py] = pt(i, (Math.max(0, Math.min(100, d.score)) / 100) * R);
        return <circle key={d.domain} cx={px} cy={py} r={4.5} fill={COLOR_HEX[wheelColorForScore(d.score)]} stroke="#fff" strokeWidth={1.2} />;
      })}
    </svg>
  );
}

function WheelView({
  domains,
  organs,
}: {
  domains: WheelDomain[];
  organs: Array<{ code: string; name_fr: string; score: { score: number; color: OrganColor } | null }>;
}) {
  const scored = organs.filter((o) => o.score).sort((a, b) => (a.score!.score - b.score!.score));
  return (
    <div style={{ padding: '4px 2px', overflowY: 'auto', height: '100%' }}>
      {domains && domains.length > 0 && (
        <>
          <div style={sectionTitle}>Roue de transformation</div>
          <div style={{ marginBottom: 16 }}>
            <WheelRadar domains={domains} />
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

// ── Scribe SOAP (praticien) : dictée live → transcription éditable → SOAP IA ──
// Web Speech API (micro local, gratuit) remplit la transcription ; « Générer le
// SOAP » appelle l'edge generate-soap (DeepSeek) → S/O/A/P éditables → enregistre
// au dossier (createNote) + partageable (barre existante « Partager au patient »).
function SoapScribeTab({
  soap,
  onSoap,
  patientId,
  patientContext,
}: {
  soap: SoapNote | null;
  onSoap: (s: SoapNote) => void;
  patientId?: string | null;
  patientContext?: Record<string, unknown>;
}) {
  const scribe = useWebSpeechScribe({ lang: 'fr-FR' });
  const [text, setText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // La dictée alimente la transcription éditable (arrêter la dictée pour corriger).
  useEffect(() => { if (scribe.transcript) setText(scribe.transcript); }, [scribe.transcript]);

  const canGen = text.trim().length >= 12 && !generating;

  const generate = async () => {
    if (!canGen) { setErr('Dictez ou saisissez d’abord la consultation.'); return; }
    scribe.stop(); // fige la dictée pendant la génération (transcription stable)
    setGenerating(true); setErr(null); setSaved(false);
    try {
      const s = await generateSoapFromTranscript(text.trim(), { language: 'fr', patientContext });
      onSoap(s);
    } catch (e) { setErr((e as { message?: string })?.message || 'Échec de la génération.'); }
    finally { setGenerating(false); }
  };

  const save = async () => {
    if (!patientId || !soap) return;
    setSaving(true); setErr(null);
    try {
      await medosApi.createNote(patientId, {
        subjective: soap.subjective || undefined,
        objective: soap.objective || undefined,
        assessment: soap.assessment || undefined,
        plan: soap.plan || undefined,
      } as any);
      setSaved(true);
    } catch (e) { setErr((e as { message?: string })?.message || 'Échec de l’enregistrement.'); }
    finally { setSaving(false); }
  };

  const setField = (k: keyof SoapNote, v: string) =>
    onSoap({ subjective: null, objective: null, assessment: null, plan: null, ...(soap || {}), [k]: v });

  const taBase: React.CSSProperties = { width: '100%', boxSizing: 'border-box', resize: 'vertical', borderRadius: 8, border: '1px solid var(--zw-border)', color: 'var(--zw-text)', fontSize: 12.5, lineHeight: 1.5, padding: 8, fontFamily: 'inherit' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, height: '100%', overflowY: 'auto', padding: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {scribe.supported ? (
          <button
            onClick={scribe.toggle}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: scribe.listening ? '#ef4444' : 'var(--brand-primary)', color: '#fff' }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', opacity: scribe.listening ? 1 : 0.85 }} />
            {scribe.listening ? 'Dictée en cours — cliquer pour arrêter' : 'Dicter la consultation'}
          </button>
        ) : (
          <span style={{ fontSize: 11.5, color: 'var(--zw-text-muted)' }}>Dictée non supportée ici — saisissez le résumé ci-dessous.</span>
        )}
        {(text || scribe.transcript) ? (
          <button onClick={() => { setText(''); scribe.reset(); setSaved(false); }} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--zw-border-strong)', background: 'transparent', color: 'var(--zw-text-soft)', cursor: 'pointer', fontSize: 11.5 }}>Effacer</button>
        ) : null}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="La dictée s’affiche ici (ou saisissez le déroulé de la consultation). Vous pouvez corriger avant de générer le SOAP."
        style={{ ...taBase, minHeight: 84, background: 'var(--zw-bg-subtle)' }}
      />
      {scribe.listening && scribe.interim ? (
        <div style={{ fontSize: 11.5, color: 'var(--zw-text-muted)', fontStyle: 'italic', marginTop: -4 }}>… {scribe.interim}</div>
      ) : null}

      <button
        onClick={generate}
        disabled={!canGen}
        style={{ padding: '9px 14px', borderRadius: 9, border: 'none', cursor: canGen ? 'pointer' : 'not-allowed', fontSize: 12.5, fontWeight: 700, background: canGen ? 'var(--brand-primary)' : 'var(--zw-border-strong)', color: '#fff', opacity: canGen ? 1 : 0.7 }}
      >
        {generating ? 'Génération du SOAP…' : '✨ Générer le SOAP'}
      </button>

      {err ? <div style={{ fontSize: 11.5, color: '#dc2626' }}>{err}</div> : null}

      {soap ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 2 }}>
          {([['subjective', 'S — Subjectif'], ['objective', 'O — Objectif'], ['assessment', 'A — Analyse'], ['plan', 'P — Plan']] as Array<[keyof SoapNote, string]>).map(([k, label]) => (
            <div key={String(k)}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--brand-primary)', letterSpacing: 0.3, marginBottom: 3 }}>{label}</div>
              <textarea value={String(soap[k] ?? '')} onChange={(e) => setField(k, e.target.value)} style={{ ...taBase, minHeight: 42, background: '#fff' }} />
            </div>
          ))}
          {patientId ? (
            <button onClick={save} disabled={saving} style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid var(--zw-border-strong)', cursor: saving ? 'default' : 'pointer', fontSize: 12, fontWeight: 700, background: saved ? '#dcfce7' : 'transparent', color: saved ? '#166534' : 'var(--zw-text)' }}>
              {saving ? 'Enregistrement…' : saved ? '✓ Enregistré au dossier' : 'Enregistrer au dossier'}
            </button>
          ) : null}
          <div style={{ fontSize: 10.5, color: 'var(--zw-text-faint)', lineHeight: 1.4 }}>Aide à la rédaction (assistant) — vérifiez avant d’enregistrer / partager. Ne constitue pas un diagnostic.</div>
        </div>
      ) : null}
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
  const name = (l: LabResult) => l.test_name || l.name || l.label || l.code || 'Analyse';
  const val = (l: LabResult) => l.value_numeric ?? l.value_text ?? l.value;
  const range = (l: LabResult) =>
    l.reference_low != null || l.reference_high != null
      ? `${l.reference_low ?? ''}–${l.reference_high ?? ''}`
      : l.reference_range || null;
  const date = (l: LabResult) => String(l.reported_at || l.taken_at || l.result_date || l.date || l.created_at || '').slice(0, 10);
  const outOfRange = (l: LabResult) => {
    const v = Number(l.value_numeric);
    if (Number.isFinite(v)) {
      if (l.reference_high != null && v > Number(l.reference_high)) return true;
      if (l.reference_low != null && v < Number(l.reference_low)) return true;
    }
    return !!l.flag;
  };
  return (
    <div style={{ padding: '8px 12px', overflowY: 'auto', height: '100%' }}>
      <div style={sectionTitle}>Bilans biologiques</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((l, i) => {
          const flagged = outOfRange(l);
          const r = range(l);
          const d = date(l);
          return (
            <div key={l.id || i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--zw-border)' }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--zw-text)' }}>{name(l)}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: flagged ? '#f97316' : 'var(--zw-text)' }}>
                {val(l) ?? '—'}{l.unit ? ` ${l.unit}` : ''}
              </span>
              {r ? <span style={{ fontSize: 11, color: 'var(--zw-text-muted)' }}>réf. {r}</span> : null}
              {d ? <span style={{ fontSize: 11, color: 'var(--zw-text-faint)', width: 74, textAlign: 'right' }}>{d}</span> : null}
            </div>
          );
        })}
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
  onUpload,
  uploading = false,
}: {
  attachments: AttachmentLite[];
  selectedImg: { url: string; name: string; mime?: string } | null;
  onPick: (a: AttachmentLite) => void;
  onBack: () => void;
  onUpload: (file: File) => void;
  uploading?: boolean;
}) {
  const uploadBtn = (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 9, border: '1px dashed var(--brand-primary)', background: 'var(--zw-bg-subtle)', color: 'var(--brand-primary)', fontSize: 12.5, fontWeight: 700, cursor: uploading ? 'wait' : 'pointer', marginBottom: 10 }}>
      {uploading ? 'Chargement…' : '＋ Charger une image / photo'}
      <input
        type="file"
        accept="image/*,application/pdf"
        style={{ display: 'none' }}
        disabled={uploading}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.currentTarget.value = ''; }}
      />
    </label>
  );
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
  if (!attachments || attachments.length === 0) {
    return (
      <div style={{ padding: '8px 12px', height: '100%', overflowY: 'auto' }}>
        {uploadBtn}
        <div style={{ ...emptyHint, height: 'auto', padding: '24px 8px' }}>Aucune pièce jointe. Chargez une image ou une photo à partager pendant la consultation.</div>
      </div>
    );
  }
  return (
    <div style={{ padding: '8px 12px', overflowY: 'auto', height: '100%' }}>
      {uploadBtn}
      <div style={sectionTitle}>Pièces jointes</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {attachments.map((a) => (
          <button key={a.id} onClick={() => onPick(a)} style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', padding: '8px 9px', borderRadius: 8, border: '1px solid var(--zw-border)', background: '#f6f4ee', cursor: 'pointer', fontSize: 13, color: 'var(--zw-text)' }}>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.file_name}</span>
            <span style={{ fontSize: 11, color: 'var(--brand-primary)', fontWeight: 700, flexShrink: 0 }}>Choisir</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Boutique : grille de produits/services vendables. Le bouton « Payer » ouvre le
// lien de paiement (checkout Stripe/PawaPay). Rendu côté praticien ET patient.
// Prix formaté façon boutique (ex. « 61,00 € », « 38,64 € »).
function fmtPrice(v: number | null | undefined, cur: string): string {
  if (v == null) return 'Gratuit';
  const s = v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return cur === 'EUR' ? `${s} €` : `${s} ${cur}`;
}

// CÔTÉ PRATICIEN — grille de vignettes cliquables pour CHOISIR les produits à
// présenter au patient (sélection multiple ; seul le choix est partagé).
function ShopPicker({
  products, selected, onToggle, brand,
}: {
  products: ShopProduct[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  brand: ShopBrand;
}) {
  if (!products || products.length === 0) return <div style={emptyHint}>Aucun produit dans la boutique.</div>;
  return (
    <div style={{ padding: '10px 12px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
        <div style={sectionTitle}>{brand.name || 'Boutique'}</div>
        <span style={{ fontSize: 11, color: 'var(--zw-text-muted)', textAlign: 'right' }}>
          {selected.size > 0 ? `${selected.size} produit${selected.size > 1 ? 's' : ''} choisi${selected.size > 1 ? 's' : ''}` : 'Choisissez à présenter'}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(138px, 1fr))', gap: 10 }}>
        {products.map((p) => {
          const on = selected.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onToggle(p.id)}
              aria-pressed={on}
              title={p.name}
              style={{
                textAlign: 'left', padding: 0, cursor: 'pointer', position: 'relative',
                border: on ? '2px solid var(--brand-primary)' : '1px solid var(--zw-border)',
                borderRadius: 12, overflow: 'hidden', background: 'var(--zw-bg-subtle)',
                display: 'flex', flexDirection: 'column',
                boxShadow: on ? '0 4px 14px rgba(0,0,0,0.14)' : 'none',
              }}
            >
              {on && (
                <span style={{ position: 'absolute', top: 6, right: 6, zIndex: 2, width: 20, height: 20, borderRadius: '50%', background: 'var(--brand-primary)', color: '#fff', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>
              )}
              <div style={{ width: '100%', aspectRatio: '1 / 1', background: '#efece6', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {p.image ? <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 24 }}>🌿</span>}
              </div>
              <div style={{ padding: '8px 9px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--zw-text)', lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</div>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--zw-text)' }}>{fmtPrice(p.price, p.currency)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// CÔTÉ PATIENT (+ Tableau) — vitrine « comme en ligne » des produits choisis :
// grande photo, description, prix, bouton Acheter, avec le branding du tenant.
function ShopShowcase({ products, brand }: { products: ShopProduct[]; brand?: ShopBrand }) {
  if (!products || products.length === 0) return null;
  const single = products.length === 1;
  return (
    <div style={{
      height: '100%', overflowY: 'auto',
      backgroundColor: '#e7ddcd',
      backgroundImage: 'linear-gradient(rgba(125,95,65,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(125,95,65,0.09) 1px, transparent 1px)',
      backgroundSize: '28px 28px',
    }}>
      {(brand?.name || brand?.domain) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--zw-border)' }}>
          {brand?.logo ? <img src={brand.logo} alt="" style={{ height: 26, width: 'auto', borderRadius: 6 }} /> : <span style={{ fontSize: 18 }} aria-hidden="true">🌿</span>}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {brand?.name && <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--zw-text)' }}>{brand.name}</span>}
            {brand?.domain && <span style={{ fontSize: 11.5, color: 'var(--zw-text-muted)' }}>{brand.domain}</span>}
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--zw-text-muted)', border: '1px solid var(--zw-border)', borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>Recommandé en consultation</span>
        </div>
      )}
      <div style={{ display: single ? 'block' : 'grid', gridTemplateColumns: single ? undefined : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, padding: 16, maxWidth: single ? 760 : undefined, margin: single ? '0 auto' : undefined }}>
        {products.map((p) => (
          <ShowcaseCard key={p.id} p={p} big={single} />
        ))}
      </div>
    </div>
  );
}

function ShowcaseCard({ p, big }: { p: ShopProduct; big: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: big ? 'row' : 'column', background: '#fffcf7', border: '1px solid rgba(125,95,65,0.18)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 10px 30px rgba(90,60,30,0.12)' }}>
      <div style={{ position: 'relative', flex: big ? '0 0 44%' : undefined, aspectRatio: big ? undefined : '4 / 3', background: '#efece6', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: big ? 280 : undefined, overflow: 'hidden' }}>
        {p.image ? <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 44 }} aria-hidden="true">🌿</span>}
        {p.badge && <span style={{ position: 'absolute', top: 12, left: 12, background: 'var(--brand-primary)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: 0.4 }}>{p.badge}</span>}
      </div>
      <div style={{ flex: 1, padding: big ? '24px 26px' : '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: big ? 23 : 16, fontWeight: 800, color: 'var(--zw-text)', lineHeight: 1.15 }}>{p.name}</div>
        {p.description && <div style={{ fontSize: big ? 14 : 12.5, color: 'var(--zw-text-muted)', lineHeight: 1.55 }}>{p.description}</div>}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
          <span style={{ fontSize: big ? 25 : 18, fontWeight: 800, color: 'var(--zw-text)' }}>{fmtPrice(p.price, p.currency)}</span>
          {p.compareAtPrice != null && p.compareAtPrice > (p.price ?? 0) && (
            <span style={{ fontSize: big ? 15 : 13, color: 'var(--zw-text-muted)', textDecoration: 'line-through' }}>{fmtPrice(p.compareAtPrice, p.currency)}</span>
          )}
        </div>
        <button
          onClick={() => { if (typeof window !== 'undefined' && p.payUrl) window.open(p.payUrl, '_blank', 'noopener'); }}
          style={{ marginTop: 'auto', alignSelf: big ? 'flex-start' : 'stretch', padding: big ? '12px 28px' : '11px 18px', borderRadius: 12, border: 'none', background: 'var(--brand-primary)', color: '#fff', fontSize: big ? 15 : 13.5, fontWeight: 800, cursor: 'pointer' }}
        >
          {p.cta || 'Acheter'}
        </button>
      </div>
    </div>
  );
}

// Rendu d'une scène clinique partagée — réutilisé par le cockpit patient ET la
// SCÈNE CENTRALE de la salle Consultation. Wrappé dans les vars --zw-* pour que
// les composants portés (jumeau, roue, SOAP, labs, ordonnance, imagerie) rendent.
export function SharedSceneView({ scene, frameless = false }: { scene: CockpitScene | null; frameless?: boolean }) {
  if (!scene || scene.kind === 'clear') return null;
  // `frameless` (salle mobile immersive) : la carte creme disparait — fonds
  // transparents, textes/controles passes en clair — la scene partagee se pose
  // DIRECTEMENT sur la grille sombre de la salle (aucun panneau visible).
  return (
    <div data-cr-scene={frameless ? 'frameless' : undefined} style={{ ...COCKPIT_VARS, width: '100%', height: '100%' }}>
      {frameless ? (
        <style>{`
[data-cr-scene="frameless"] div{background:transparent !important;box-shadow:none !important}
[data-cr-scene="frameless"] button{background:rgba(255,255,255,0.08) !important;color:#e9e4dd !important;border-color:rgba(255,255,255,0.18) !important}
[data-cr-scene="frameless"] span:not([style*="background"]),[data-cr-scene="frameless"] p,[data-cr-scene="frameless"] label{color:#e9e4dd !important}
[data-cr-scene="frameless"] canvas{background:transparent !important}
`}</style>
      ) : null}
      {scene.kind === 'twin' && (
        <TwinView organs={scene.organs} sex={scene.sex} selected={scene.focus} onSelect={() => {}} />
      )}
      {scene.kind === 'wheel' && <WheelView domains={scene.domains} organs={scene.organs} />}
      {scene.kind === 'soap' && <SoapView soap={scene.soap} />}
      {scene.kind === 'labs' && <LabsView items={scene.items} />}
      {scene.kind === 'prescription' && <PrescriptionView rx={scene.rx} />}
      {scene.kind === 'image' && <ImageView url={scene.url} name={scene.name} mime={scene.mime} />}
      {scene.kind === 'shop' && <ShopShowcase products={scene.products} brand={scene.brand} />}
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
      <button data-cr="cockpit-fab" onClick={() => setOpen(true)} style={fabStyle} title="Voir le partage du praticien">
        🩺
      </button>
    );
  }

  return (
    <div data-cr="cockpit" style={{ ...panelStyle, ...COCKPIT_VARS }}>
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

function HostCockpit({ sessionId, channel, eduMode = false }: { sessionId: string; channel: CockpitChannel; eduMode?: boolean }) {
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
  const [shopProducts, setShopProducts] = useState<ShopProduct[]>([]);
  const [shopBrand, setShopBrand] = useState<ShopBrand>({});
  const [selectedShopIds, setSelectedShopIds] = useState<Set<string>>(new Set());
  const [selectedImg, setSelectedImg] = useState<{ url: string; name: string; mime?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  // Mode éducation : jumeau anatomique GÉNÉRIQUE + cas d'étude anonymisé sélectionné.
  const [genericOrgans, setGenericOrgans] = useState<OrganNode[]>([]);
  const [studyCaseId, setStudyCaseId] = useState<string | null>(null);
  const studyCase = eduMode && studyCaseId ? MEDOS_STUDY_CASES.find((c) => c.id === studyCaseId) || null : null;

  // Charge le contexte + le dossier (jumeau, bilan, SOAP). Si la session n'est
  // pas une téléconsult (404) ou accès refusé → on n'affiche rien (pas de FAB).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (eduMode) {
          // Live MEDOS « éducation » : pas de patient → jumeau 3D anatomique GÉNÉRIQUE.
          // ROBUSTE : jamais de loadFailed ici (le FAB doit s'afficher même si le
          // référentiel est indisponible → jumeau vide). Un cas d'étude anonymisé
          // applique ensuite des scores fictifs + SOAP/bilans fictifs.
          let generic: OrganNode[] = [];
          try {
            const refs = await getReferential().catch(() => ({ organs: [], biomarkers: [] }));
            if (!alive) return;
            generic = buildOrganNodes(refs, { organs: [], biomarkers: [], wheel: null } as any);
          } catch { generic = []; }
          if (!alive) return;
          setGenericOrgans(generic);
          setOrgans(generic);
          setLoading(false);
          return;
        }
        const c = await getClinicalContext(sessionId);
        if (!alive) return;
        setCtx(c);
        const [refs, state] = await Promise.all([
          getReferential().catch(() => ({ organs: [], biomarkers: [] })),
          getTwinState(c.patient_id).catch(() => ({ organs: [], biomarkers: [], wheel: null })),
        ]);
        if (!alive) return;
        setOrgans(buildOrganNodes(refs, state));
        // Le backend (twin.service.getState) renvoie state.wheel = ARRAY de lignes
        // med_transformation_wheel (order by measured_at desc), PAS { domains: [...] }.
        // On garde la dernière mesure par domaine.
        {
          const wheelRows = Array.isArray(state?.wheel) ? state.wheel : (state?.wheel?.domains || []);
          const seenDom = new Set<string>();
          const wheelDomains = [] as Array<{ domain: string; score: number }>;
          for (const w of wheelRows) {
            if (!w || w.domain == null || seenDom.has(w.domain)) continue;
            seenDom.add(w.domain);
            wheelDomains.push({ domain: w.domain, score: Number(w.score) || 0 });
          }
          setWheel(wheelDomains);
        }
        getLatestSoap(c.patient_id).then((s) => alive && setSoap(s)).catch(() => {});
        getLabs(c.patient_id).then((r) => alive && setLabs(r)).catch(() => {});
        getSignedPrescriptions(c.patient_id).then((r) => alive && setPrescriptions(r)).catch(() => {});
        getAttachments(c.patient_id).then((r) => alive && setAttachments(r)).catch(() => {});
        getStorefront().then((r) => {
          if (!alive) return;
          setShopProducts(r.products);
          setShopBrand(r.brand);
          // Pré-remplissage préparé au Studio Live Créateur (étape « Dossier MEDOS ») :
          // pré-coche les produits choisis avant le lancement (ceux encore au catalogue).
          try {
            const raw = localStorage.getItem(`medos:prefill:${sessionId}`);
            if (raw) {
              const pre = JSON.parse(raw);
              const ids: string[] = Array.isArray(pre?.shopProductIds) ? pre.shopProductIds : [];
              if (ids.length) {
                const valid = new Set(r.products.map((p) => p.id));
                setSelectedShopIds(new Set(ids.filter((id) => valid.has(id))));
              }
            }
          } catch { /* prefill absent/illisible : sélection vide */ }
        }).catch(() => {});
      } catch {
        if (alive) setLoadFailed(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [sessionId, eduMode]);

  const organScores = useMemo(
    () => organs.map((o) => ({ code: o.code, name_fr: o.name_fr, score: o.score })),
    [organs],
  );

  const latestRx = prescriptions[0] || null;

  const displaySex: 'female' | 'male' = studyCase?.sex || ctx?.sex || 'female';

  // Charge un cas d'étude anonymisé (scores fictifs sur le jumeau + SOAP/bilans/roue).
  const loadStudyCase = (id: string) => {
    const c = id ? MEDOS_STUDY_CASES.find((x) => x.id === id) || null : null;
    setStudyCaseId(c ? c.id : null);
    if (c) {
      setOrgans(applyCaseOrganScores(genericOrgans, c.organScores));
      setWheel(c.wheel);
      setSoap(c.soap);
      setLabs(c.labs);
      setTab('twin');
    } else {
      setOrgans(genericOrgans);
      setWheel([]);
      setSoap(null);
      setLabs([]);
    }
  };

  const shareCurrent = () => {
    if (tab === 'twin') shareScene({ kind: 'twin', sex: displaySex, organs, focus: selected });
    else if (tab === 'wheel') shareScene({ kind: 'wheel', domains: wheel, organs: organScores });
    else if (tab === 'soap' && soap) shareScene({ kind: 'soap', soap });
    else if (tab === 'labs' && labs.length) shareScene({ kind: 'labs', items: labs });
    else if (tab === 'rx' && latestRx) shareScene({ kind: 'prescription', rx: latestRx });
    else if (tab === 'image' && selectedImg?.url) shareScene({ kind: 'image', url: selectedImg.url, name: selectedImg.name, mime: selectedImg.mime });
    else if (tab === 'shop' && selectedShopIds.size) shareScene({ kind: 'shop', products: shopProducts.filter((p) => selectedShopIds.has(p.id)), brand: shopBrand });
  };

  const toggleShopProduct = (id: string) =>
    setSelectedShopIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  // Sélection d'une pièce jointe : on récupère l'URL signée puis on l'affiche en
  // aperçu ; « Partager » l'enverra ensuite sur la scène.
  const pickAttachment = async (a: AttachmentLite) => {
    setSelectedImg({ url: '', name: a.file_name, mime: a.mime_type || undefined });
    const url = await getAttachmentUrl(a.id);
    setSelectedImg({ url, name: a.file_name, mime: a.mime_type || undefined });
  };

  // Charger une image/photo À LA VOLÉE pendant la consultation : upload dans le bucket
  // Storage `medos` (comme une pièce jointe patient, catégorie imagerie, visible patient),
  // puis sélection + aperçu → le praticien clique « Partager » pour la diffuser.
  const [uploadingImg, setUploadingImg] = useState(false);
  const handleUploadImage = async (file: File) => {
    if (!file || !ctx?.patient_id) return;
    setUploadingImg(true);
    try {
      const { upload_url, storage_path } = await attachmentsApi.getUploadUrl('medos');
      const put = await fetch(upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'true' },
      });
      if (!put.ok) throw new Error(`upload ${put.status}`);
      const created = await attachmentsApi.register({
        owner_type: 'patient', owner_id: ctx.patient_id, patient_id: ctx.patient_id,
        file_name: file.name, file_size_bytes: file.size,
        mime_type: file.type || 'application/octet-stream', storage_path,
        category: 'imaging', visible_to_patient: true,
      } as any);
      const list = await getAttachments(ctx.patient_id);
      setAttachments(list);
      const fresh = list.find((x) => x.id === (created as any)?.id) || (created as any);
      if (fresh) await pickAttachment(fresh);
    } catch (e) {
      console.error('[cockpit] upload image', e);
    } finally {
      setUploadingImg(false);
    }
  };

  const canShare =
    tab === 'twin' ||
    tab === 'wheel' ||
    (tab === 'soap' && !!soap) ||
    (tab === 'labs' && labs.length > 0) ||
    (tab === 'rx' && !!latestRx) ||
    (tab === 'image' && !!selectedImg?.url) ||
    (tab === 'shop' && selectedShopIds.size > 0);

  const isSharing = !!sharedScene && sharedScene.kind !== 'clear';
  const tabKind: Record<Tab, CockpitScene['kind']> = {
    twin: 'twin', wheel: 'wheel', soap: 'soap', labs: 'labs', rx: 'prescription', image: 'image', shop: 'shop',
  };
  const sharingThisTab = isSharing && sharedScene!.kind === tabKind[tab];

  if (loadFailed) return null; // session non-médicale → cockpit masqué

  if (!open) {
    return (
      <button data-cr="cockpit-fab" onClick={() => setOpen(true)} style={fabStyle} title={eduMode ? 'Jumeau 3D — éducation santé' : 'Dossier clinique du patient'}>
        🩺
        {isSharing && <span style={fabDot} />}
      </button>
    );
  }

  const tabs: Array<[Tab, string]> = eduMode
    ? (studyCase
        ? [['twin', 'Jumeau 3D'], ['wheel', 'Roue'], ['labs', 'Bilans'], ['soap', 'SOAP']]
        : [['twin', 'Jumeau 3D'], ['wheel', 'Roue de santé']])
    : [
        ['twin', 'Jumeau'],
        ['wheel', 'Roue'],
        ['labs', 'Bilans'],
        ['image', 'Imagerie'],
        ['rx', 'Ordonnance'],
        ['soap', 'SOAP'],
        ['shop', 'Boutique'],
      ];

  return (
    <div data-cr="cockpit" style={{ ...panelStyle, ...COCKPIT_VARS }}>
      <div style={headerStyle}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {eduMode ? (studyCase ? `Cas : ${studyCase.title}` : 'Jumeau 3D — Éducation santé') : (ctx?.patient_name || 'Dossier patient')}
        </span>
        <button onClick={() => setOpen(false)} style={closeBtn} title="Réduire">—</button>
      </div>

      {/* Cas d'étude anonymisé (mode éducation) — données 100 % fictives. */}
      {eduMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#f6f4ee', borderBottom: '1px solid var(--zw-border)' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--zw-text-muted)', whiteSpace: 'nowrap' }}>Cas d&apos;étude</span>
          <select
            value={studyCaseId || ''}
            onChange={(e) => loadStudyCase(e.target.value)}
            style={{ flex: 1, minWidth: 0, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--zw-border-strong)', background: '#f6f4ee', color: 'var(--zw-text)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
          >
            <option value="">Jumeau générique (anatomie)</option>
            {MEDOS_STUDY_CASES.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
      )}

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 2, padding: '6px 6px 0', background: '#f6f4ee', borderBottom: '1px solid var(--zw-border)', overflowX: 'auto' }}>
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
              <TwinView organs={organs} sex={displaySex} selected={selected} onSelect={setSelected} />
            )}
            {tab === 'wheel' && <WheelView domains={wheel} organs={organScores} />}
            {tab === 'soap' && (
              <SoapScribeTab
                soap={soap}
                onSoap={setSoap}
                patientId={ctx?.patient_id ?? null}
                patientContext={ctx ? { name: ctx.patient_name, sex: ctx.sex, motif: (ctx as any).agenda_reason } : undefined}
              />
            )}
            {tab === 'labs' && <LabsView items={labs} />}
            {tab === 'rx' && <PrescriptionView rx={latestRx} />}
            {tab === 'image' && (
              <ImageTab attachments={attachments} selectedImg={selectedImg} onPick={pickAttachment} onBack={() => setSelectedImg(null)} onUpload={handleUploadImage} uploading={uploadingImg} />
            )}
            {tab === 'shop' && <ShopPicker products={shopProducts} selected={selectedShopIds} onToggle={toggleShopProduct} brand={shopBrand} />}
          </>
        )}
      </div>

      {/* Barre de partage */}
      <div style={shareBar}>
        {sharingThisTab ? (
          <span style={{ fontSize: 11.5, color: '#22c55e', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} /> {eduMode ? 'Partagé au live' : 'Partagé au patient'}
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
          {eduMode ? 'Partager au live' : 'Partager au patient'}
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
  eduMode = false,
}: {
  sessionId: string;
  mode: 'host' | 'patient';
  channel: CockpitChannel;
  eduMode?: boolean;
}) {
  // Diffuse la scène clinique partagée vers un éventuel SmartBoardCompositor (scène
  // « Dossier MEDOS ») — en TÉLÉCONSULT (Tableau) comme en live/formation. CockpitDock
  // est monté dans les deux cas (téléconsult via ConsultationRoom, live via
  // MedTeleconsultCockpit), donc l'event part bien partout. window.__liriMedosScene =
  // dernier état, lu au montage d'un compositeur ouvert APRÈS le partage.
  useEffect(() => {
    const scene = channel.scene ?? null;
    if (typeof window !== 'undefined') {
      (window as unknown as { __liriMedosScene?: CockpitScene | null }).__liriMedosScene = scene;
      window.dispatchEvent(new CustomEvent('LIRI_MEDOS_SHARED_SCENE', { detail: { scene } }));
    }
  }, [channel.scene]);
  // Nettoyage au DÉMONTAGE (sortie de consultation) : ne pas laisser la scène
  // clinique du patient PRÉCÉDENT fuiter vers une consultation suivante (SPA :
  // window persiste sans reload) → un compositeur monté après lirait l'ancienne.
  useEffect(() => () => {
    if (typeof window !== 'undefined') {
      (window as unknown as { __liriMedosScene?: CockpitScene | null }).__liriMedosScene = null;
      window.dispatchEvent(new CustomEvent('LIRI_MEDOS_SHARED_SCENE', { detail: { scene: null } }));
    }
  }, []);
  return mode === 'host' ? (
    <HostCockpit sessionId={sessionId} channel={channel} eduMode={eduMode} />
  ) : (
    <PatientCockpit channel={channel} />
  );
}

export default function MedTeleconsultCockpit({
  sessionId,
  mode,
  eduMode = false,
  onSharedSceneChange,
}: {
  sessionId: string | null | undefined;
  mode: 'host' | 'patient';
  /** Live MEDOS « éducation » : jumeau 3D anatomique GÉNÉRIQUE, sans dossier
   *  patient (pas de labs/SOAP/Rx). Pour partager de l'anatomie à un groupe. */
  eduMode?: boolean;
  /** Remonte la scène clinique actuellement partagée (jumeau/roue/SOAP/labs…)
   *  au parent → permet de l'afficher sur le SMARTBOARD CENTRAL du live. */
  onSharedSceneChange?: (scene: CockpitScene | null) => void;
}) {
  const channel = useCockpitChannel(sessionId ?? null, mode);
  // L'émission de la scène partagée (window.__liriMedosScene + event LIRI_MEDOS_SHARED_SCENE)
  // vit désormais dans CockpitDock, monté en téléconsult ET en live. Ici on ne garde que
  // le callback de compat (fallback prop).
  useEffect(() => {
    onSharedSceneChange?.(channel.scene ?? null);
  }, [channel.scene, onSharedSceneChange]);
  if (!sessionId) return null;
  return <CockpitDock sessionId={sessionId} mode={mode} channel={channel} eduMode={eduMode} />;
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
  height: 'min(76vh, 720px)', background: '#f6f4ee', borderRadius: 16, overflow: 'hidden',
  display: 'flex', flexDirection: 'column', boxShadow: '0 18px 60px rgba(0,0,0,0.42)',
  border: '1px solid rgba(43,36,32,0.14)',
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
  flex: 1, minHeight: 0, padding: 12, background: '#f6f4ee', overflow: 'hidden',
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
