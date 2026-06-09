import { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity, Sparkles, AlertTriangle, FlaskConical, Brain, ShieldCheck,
  ChevronLeft, Plus, Check, X, Loader2, HelpCircle,
} from 'lucide-react';
import { twinApi, COLOR_HEX, COLOR_LABEL, type OrganColor } from './api';
import {
  WheelPanel, MindmapPanel, TimelinePanel, LongitudinalPanel,
  SimulatorPanel, LabReaderPanel, MetabolicMapPanel, CopilotPanel,
} from './panels';
import { OnboardingTour } from './OnboardingTour';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

const BodyViewer = lazy(() =>
  import('./BodyViewer').then((m) => ({ default: m.BodyViewer })),
);

const TABS: Array<{ key: string; i18nKey: string }> = [
  { key: 'body', i18nKey: 'twin:tabs.body3d' },
  { key: 'wheel', i18nKey: 'twin:tabs.wheel' },
  { key: 'lab', i18nKey: 'twin:tabs.lab' },
  { key: 'correlations', i18nKey: 'twin:tabs.correlations' },
  { key: 'timeline', i18nKey: 'twin:tabs.timeline' },
  { key: 'longitudinal', i18nKey: 'twin:tabs.longitudinal' },
  { key: 'simulator', i18nKey: 'twin:tabs.simulator' },
  { key: 'copilot', i18nKey: 'twin:tabs.copilot' },
];

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

// Profil démo réaliste (foie + métabolisme + carences) — wow instantané.
const DEMO_PROFILE: Array<{ biomarker_code: string; value: number }> = [
  { biomarker_code: 'ALT', value: 46 }, { biomarker_code: 'GGT', value: 52 },
  { biomarker_code: 'AST', value: 30 }, { biomarker_code: 'CRP_HS', value: 4.1 },
  { biomarker_code: 'FERRITIN', value: 255 }, { biomarker_code: 'HOMA_IR', value: 2.3 },
  { biomarker_code: 'TRIGLYCERIDES', value: 142 }, { biomarker_code: 'HDL', value: 41 },
  { biomarker_code: 'GLUCOSE', value: 96 }, { biomarker_code: 'HBA1C', value: 5.6 },
  { biomarker_code: 'TSH', value: 3.3 }, { biomarker_code: 'VIT_D', value: 21 },
  { biomarker_code: 'B12', value: 320 }, { biomarker_code: 'MAGNESIUM', value: 1.8 },
];

const panel: React.CSSProperties = { background: '#fff', borderRadius: 14, border: '1px solid #e8eaf0', padding: 18 };
const head: React.CSSProperties = { fontSize: 14, fontWeight: 700, margin: 0, marginBottom: 12, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 7 };

export function TwinPage() {
  const { t } = useTranslation();
  const { patientId = '' } = useParams();
  const [state, setState] = useState<any>(null);
  const [refs, setRefs] = useState<any>({ organs: [], biomarkers: [] });
  const [patientName, setPatientName] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [assistant, setAssistant] = useState<any>(null);
  const [staged, setStaged] = useState<Array<{ biomarker_code: string; value: number }>>([]);
  const [pickCode, setPickCode] = useState('');
  const [pickValue, setPickValue] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState('body');

  const load = useCallback(async () => {
    try {
      const [st, rf] = await Promise.all([twinApi.state(patientId), twinApi.referential()]);
      setState(st);
      setRefs(rf);
    } catch (e: any) {
      setErr(e?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    load();
    fetch(API + '/med/patients/' + patientId, {
      headers: {
        Authorization: 'Bearer ' + (localStorage.getItem('supabase_token') || ''),
        'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
      },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const p = d?.data || d;
        if (p) setPatientName(`${p.first_name || ''} ${p.last_name || ''}`.trim());
      })
      .catch(() => {});
  }, [load, patientId]);

  const organs = (state?.organs || []).map((o: any) => ({
    code: o.code,
    name_fr: o.name_fr,
    position: o.position,
    score: o.score ? { score: o.score.score, color: o.score.color as OrganColor } : null,
  }));
  const selectedOrgan = organs.find((o: any) => o.code === selected);
  const bmRefByCode = new Map<string, any>((refs.biomarkers || []).map((b: any) => [b.code, b]));

  async function saveBiomarkers(values: Array<{ biomarker_code: string; value: number }>) {
    if (values.length === 0) return;
    setBusy('save');
    setErr(null);
    try {
      await twinApi.addBiomarkers(patientId, values);
      setStaged([]);
      await load();
    } catch (e: any) {
      setErr(e?.message || 'Échec');
    } finally {
      setBusy(null);
    }
  }

  async function askAssistant() {
    if (!selected) return;
    setBusy('assistant');
    setAssistant(null);
    setErr(null);
    try {
      const res = await twinApi.organAssistant(patientId, selected);
      setAssistant(res?.output || res);
    } catch (e: any) {
      setErr(e?.message || 'Assistant indisponible');
    } finally {
      setBusy(null);
    }
  }

  async function runAnalyze() {
    setBusy('analyze');
    setErr(null);
    try {
      await twinApi.analyze(patientId);
      await load();
    } catch (e: any) {
      setErr(e?.message || 'Analyse indisponible');
    } finally {
      setBusy(null);
    }
  }

  async function setHypoStatus(id: string, status: 'validated' | 'rejected') {
    await twinApi.setHypothesis(id, status);
    await load();
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>{t('common:loading')}</div>;
  }

  const scoredCount = organs.filter((o: any) => o.score).length;

  return (
    <div>
      <OnboardingTour />
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Link to={`/patients/${patientId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: 'var(--brand-primary)', textDecoration: 'none', fontWeight: 600 }}>
            <ChevronLeft size={14} /> Dossier patient
          </Link>
          <h2 style={{ fontSize: 23, fontWeight: 800, margin: '4px 0 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 9 }}>
            <Activity size={22} color="var(--brand-primary)" /> Jumeau numérique {patientName && `· ${patientName}`}
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LanguageSwitcher />
          <button
            type="button"
            onClick={() => { try { localStorage.removeItem('twin_onboarding_done'); } catch { /* noop */ } window.location.reload(); }}
            title="Relancer la visite guidée"
            aria-label="Relancer la visite guidée"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: '#fff', color: 'var(--brand-primary)', border: '1px solid #e2e8f0', borderRadius: 10, cursor: 'pointer' }}
          >
            <HelpCircle size={16} />
          </button>
          <button
            onClick={runAnalyze}
            disabled={!!busy}
            className="twin-analyze-btn"
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: busy ? 'wait' : 'pointer' }}
          >
            {busy === 'analyze' ? <Loader2 size={15} className="spin" /> : <Brain size={15} />} Analyse IA — hypothèses
          </button>
        </div>
      </div>

      {/* Disclaimer permanent (sécurité clinique) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, fontSize: 12.5, color: '#92400e', marginBottom: 16 }}>
        <ShieldCheck size={15} /> Aide à la décision clinique — copilote, jamais diagnostic. Le thérapeute reste 100 % décisionnaire.
      </div>

      {/* Navigation interne (centre de commande — Module 35) */}
      <div className="twin-tabs" style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap', background: '#f1f5f9', padding: 4, borderRadius: 10 }}>
        {TABS.map((tabItem) => {
          const tourId = tabItem.key === 'body' ? 'corps-3d' : tabItem.key === 'lab' ? 'laboratoire' : tabItem.key === 'copilot' ? 'copilote' : undefined;
          return (
            <button key={tabItem.key} className="twin-tab" data-tour-id={tourId} onClick={() => setTab(tabItem.key)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: tab === tabItem.key ? '#fff' : 'transparent', color: tab === tabItem.key ? 'var(--brand-primary)' : '#64748b', boxShadow: tab === tabItem.key ? '0 1px 3px rgba(15,23,42,0.12)' : 'none', whiteSpace: 'nowrap' }}>
              {t(tabItem.i18nKey)}
            </button>
          );
        })}
      </div>

      {err && <div style={{ marginBottom: 14, padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 8, fontSize: 13 }}>{err}</div>}

      {tab === 'wheel' && <WheelPanel patientId={patientId} />}
      {tab === 'correlations' && <MindmapPanel patientId={patientId} />}
      {tab === 'timeline' && <TimelinePanel patientId={patientId} />}
      {tab === 'longitudinal' && <LongitudinalPanel patientId={patientId} />}
      {tab === 'simulator' && <SimulatorPanel patientId={patientId} />}
      {tab === 'copilot' && <CopilotPanel patientId={patientId} />}
      {tab === 'lab' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <LabReaderPanel patientId={patientId} onChange={load} />
          <MetabolicMapPanel state={state} refs={refs} />
        </div>
      )}

      {tab === 'body' && <>
      {/* Corps 3D + Organe sélectionné */}
      <div className="twin-grid-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 16 }}>
        <div className="twin-body-panel twin-body-canvas" style={{ ...panel, padding: 0, overflow: 'hidden', minHeight: 480 }}>
          <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Chargement du corps 3D…</div>}>
            <BodyViewer organs={organs} selected={selected} onSelect={(c) => { setSelected(c); setAssistant(null); }} />
          </Suspense>
        </div>

        <div style={panel}>
          {!selectedOrgan ? (
            <div>
              <h3 style={head}><Activity size={15} color="var(--brand-primary)" /> Vue d'ensemble</h3>
              {scoredCount === 0 ? (
                <p style={{ fontSize: 13, color: '#64748b' }}>
                  Aucune donnée biologique encore. Importez/saisissez des biomarqueurs ci-dessous,
                  ou chargez le <strong>profil démo</strong> pour voir le corps se coloriser.
                </p>
              ) : (
                <p style={{ fontSize: 13, color: '#64748b' }}>
                  {scoredCount} organe(s) scoré(s). <strong>Cliquez un organe</strong> sur le corps 3D pour l'explorer.
                </p>
              )}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
                {(['green', 'yellow', 'orange', 'red'] as OrganColor[]).map((c) => (
                  <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569' }}>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: COLOR_HEX[c] }} /> {COLOR_LABEL[c]}
                  </div>
                ))}
              </div>
              {/* Liste compacte des organes scorés */}
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {organs.filter((o: any) => o.score).sort((a: any, b: any) => a.score.score - b.score.score).map((o: any) => (
                  <button key={o.code} onClick={() => setSelected(o.code)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#f8fafc', border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLOR_HEX[o.score.color as OrganColor], flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{o.name_fr}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: COLOR_HEX[o.score.color as OrganColor] }}>{o.score.score}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <OrganDetail
              organ={selectedOrgan}
              onAsk={askAssistant}
              busy={busy === 'assistant'}
              assistant={assistant}
              onClose={() => { setSelected(null); setAssistant(null); }}
            />
          )}
        </div>
      </div>

      {/* Alertes · Hypothèses · Laboratoire */}
      <div className="twin-grid-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {/* Alertes */}
        <div style={panel}>
          <h3 style={head}><AlertTriangle size={15} color="#f59e0b" /> Alertes cliniques</h3>
          {(state?.alerts || []).length === 0 ? (
            <p style={{ fontSize: 13, color: '#94a3b8' }}>Aucune alerte.</p>
          ) : (
            (state.alerts).map((a: any) => (
              <div key={a.id} style={{ padding: 10, borderRadius: 8, marginBottom: 8, background: a.severity === 'critical' ? '#fef2f2' : a.severity === 'warning' ? '#fffbeb' : '#f0f9ff', borderLeft: `3px solid ${a.severity === 'critical' ? '#ef4444' : a.severity === 'warning' ? '#f59e0b' : '#0ea5e9'}` }}>
                <div style={{ fontSize: 12.5, color: '#334155' }}>{a.message_fr}</div>
              </div>
            ))
          )}
        </div>

        {/* Hypothèses */}
        <div style={panel}>
          <h3 style={head}><Sparkles size={15} color="#7c3aed" /> Hypothèses (à valider)</h3>
          {(state?.hypotheses || []).length === 0 ? (
            <p style={{ fontSize: 13, color: '#94a3b8' }}>Lancez « Analyse IA » pour générer des hypothèses cliniques.</p>
          ) : (
            (state.hypotheses).map((h: any) => (
              <div key={h.id} style={{ padding: 10, borderRadius: 8, marginBottom: 8, background: '#f8fafc', opacity: h.status === 'rejected' ? 0.5 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{h.label_fr}</span>
                  {h.probability != null && <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed' }}>{Math.round(h.probability * 100)}%</span>}
                </div>
                {h.reasoning_fr && <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3 }}>{h.reasoning_fr}</div>}
                {h.status === 'suggested' && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button onClick={() => setHypoStatus(h.id, 'validated')} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, padding: '3px 9px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}><Check size={11} /> Valider</button>
                    <button onClick={() => setHypoStatus(h.id, 'rejected')} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, padding: '3px 9px', background: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer' }}><X size={11} /> Rejeter</button>
                  </div>
                )}
                {h.status === 'validated' && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#10b981' }}>✓ VALIDÉE</span>}
              </div>
            ))
          )}
        </div>

        {/* Laboratoire virtuel + saisie */}
        <div style={panel}>
          <h3 style={head}><FlaskConical size={15} color="#0ea5e9" /> Laboratoire</h3>
          <div className="twin-lab-row" style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <select value={pickCode} onChange={(e) => setPickCode(e.target.value)} style={{ flex: 1, padding: '7px 8px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12.5, minWidth: 0 }}>
              <option value="">— Biomarqueur —</option>
              {(refs.biomarkers || []).map((b: any) => <option key={b.code} value={b.code}>{b.name_fr} ({b.unit})</option>)}
            </select>
            <input type="number" placeholder="val." value={pickValue} onChange={(e) => setPickValue(e.target.value)} style={{ width: 70, padding: '7px 8px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12.5 }} />
            <button
              onClick={() => { if (pickCode && pickValue) { setStaged((s) => [...s.filter((x) => x.biomarker_code !== pickCode), { biomarker_code: pickCode, value: Number(pickValue) }]); setPickCode(''); setPickValue(''); } }}
              style={{ padding: '7px 10px', background: 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer' }}
            ><Plus size={14} /></button>
          </div>

          {staged.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              {staged.map((s) => (
                <div key={s.biomarker_code} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 6px', color: '#475569' }}>
                  <span>{bmRefByCode.get(s.biomarker_code)?.name_fr || s.biomarker_code}: <strong>{s.value}</strong></span>
                  <button onClick={() => setStaged((st) => st.filter((x) => x.biomarker_code !== s.biomarker_code))} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}><X size={12} /></button>
                </div>
              ))}
              <button onClick={() => saveBiomarkers(staged)} disabled={!!busy} style={{ width: '100%', marginTop: 6, padding: '8px', background: 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                {busy === 'save' ? 'Enregistrement…' : `Enregistrer ${staged.length} valeur(s) + recalculer`}
              </button>
            </div>
          )}

          <button onClick={() => saveBiomarkers(DEMO_PROFILE)} disabled={!!busy} style={{ width: '100%', padding: '8px', background: '#fff', color: '#7c3aed', border: '1px dashed #c4b5fd', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginBottom: 12 }}>
            ⚡ Charger un profil démo
          </button>

          {/* Valeurs actuelles */}
          <div style={{ maxHeight: 180, overflowY: 'auto' }}>
            {(state?.biomarkers || []).length === 0 ? (
              <p style={{ fontSize: 12, color: '#94a3b8' }}>Aucune valeur enregistrée.</p>
            ) : (
              (state.biomarkers).map((b: any) => {
                const ref = bmRefByCode.get(b.biomarker_code);
                const fc = b.flag === 'normal' ? '#10b981' : b.flag === 'critical' ? '#ef4444' : '#f59e0b';
                return (
                  <div key={b.biomarker_code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#475569' }}>{ref?.name_fr || b.biomarker_code}</span>
                    <span><strong style={{ color: '#1e293b' }}>{b.value}</strong> <span style={{ color: '#94a3b8' }}>{b.unit_raw || ref?.unit}</span> <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: fc, marginLeft: 4 }} /></span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      </>}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }`}</style>
    </div>
  );
}

function OrganDetail({ organ, onAsk, busy, assistant, onClose }: { organ: any; onAsk: () => void; busy: boolean; assistant: any; onClose: () => void }) {
  const score = organ.score;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h3 style={{ ...head, marginBottom: 4 }}>{organ.name_fr}</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={16} /></button>
      </div>
      {!score ? (
        <p style={{ fontSize: 13, color: '#94a3b8' }}>Pas encore de données pour cet organe.</p>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <span className="twin-organ-score" style={{ fontSize: 40, fontWeight: 800, color: COLOR_HEX[score.color as OrganColor], lineHeight: 1 }}>{score.score}</span>
            <span style={{ fontSize: 13, color: '#64748b' }}>/100 · {COLOR_LABEL[score.color as OrganColor]}</span>
          </div>
          {score.dimensions && Object.keys(score.dimensions).length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {Object.entries(score.dimensions).map(([dim, v]: any) => (
                <div key={dim} style={{ marginBottom: 5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b' }}><span>{dim}</span><span>{v}</span></div>
                  <div style={{ height: 5, background: '#f1f5f9', borderRadius: 3 }}><div style={{ width: `${v}%`, height: '100%', background: COLOR_HEX[(v >= 80 ? 'green' : v >= 60 ? 'yellow' : v >= 40 ? 'orange' : 'red') as OrganColor], borderRadius: 3 }} /></div>
                </div>
              ))}
            </div>
          )}
          {(score.contributing_biomarkers || []).length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Biomarqueurs contributifs</div>
              {score.contributing_biomarkers.map((c: any) => (
                <div key={c.code} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
                  <span style={{ color: '#475569' }}>{c.name_fr}</span>
                  <span style={{ color: c.flag === 'normal' ? '#10b981' : '#f59e0b', fontWeight: 600 }}>{c.value} · {c.flag}</span>
                </div>
              ))}
            </div>
          )}
          <button onClick={onAsk} disabled={busy} style={{ width: '100%', padding: '9px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: busy ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            {busy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} Pourquoi ce score ? (IA explicable)
          </button>
          {assistant && (
            <div style={{ marginTop: 12, padding: 12, background: '#faf5ff', borderRadius: 10, border: '1px solid #e9d5ff' }}>
              <div style={{ fontSize: 12.5, color: '#1e293b', lineHeight: 1.5 }}>{assistant.explanation_fr}</div>
              {(assistant.recommended_exams || []).length > 0 && (
                <div style={{ marginTop: 8, fontSize: 11.5, color: '#6b21a8' }}>
                  <strong>Examens suggérés :</strong> {assistant.recommended_exams.join(', ')}
                </div>
              )}
              {assistant.confidence != null && (
                <div style={{ marginTop: 6, fontSize: 11, color: '#94a3b8' }}>Confiance : {Math.round(assistant.confidence * 100)}%</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
