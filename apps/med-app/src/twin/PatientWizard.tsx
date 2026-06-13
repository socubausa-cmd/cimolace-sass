// MEDOS v2 — Wizard onboarding patient + initialisation Twin (Chantier 3)
// 4 étapes : Identité+RGPD → Symptômes → Biomarqueurs → Roue de transformation.
// Chaîne POST /med/patients → POST /med/twin/:id/biomarkers → POST /med/twin/:id/wheel
// puis redirige vers /twin/:patientId.

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Check, Loader2, User, Stethoscope,
  FlaskConical, Sparkles, ShieldCheck, Plus, X, Zap,
} from 'lucide-react';
import { twinApi, WHEEL_LABELS } from './api';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

// ─── Profil démo (mêmes valeurs que TwinPage) ─────────────────────────────
const DEMO_PROFILE: Array<{ biomarker_code: string; value: number }> = [
  { biomarker_code: 'ALT', value: 46 }, { biomarker_code: 'GGT', value: 52 },
  { biomarker_code: 'CRP_HS', value: 4.1 }, { biomarker_code: 'FERRITIN', value: 255 },
  { biomarker_code: 'HOMA_IR', value: 2.3 }, { biomarker_code: 'TSH', value: 3.3 },
  { biomarker_code: 'VIT_D', value: 21 }, { biomarker_code: 'B12', value: 320 },
];

// ─── Biomarqueurs saisie rapide ───────────────────────────────────────────
const QUICK_BIOMARKERS: Array<{ code: string; label: string; unit: string; placeholder: string }> = [
  { code: 'CRP_HS', label: 'CRP-HS', unit: 'mg/L', placeholder: 'ex. 1.5' },
  { code: 'TSH', label: 'TSH', unit: 'mUI/L', placeholder: 'ex. 2.0' },
  { code: 'VIT_D', label: 'Vitamine D', unit: 'ng/mL', placeholder: 'ex. 30' },
  { code: 'FERRITIN', label: 'Ferritine', unit: 'µg/L', placeholder: 'ex. 80' },
  { code: 'HOMA_IR', label: 'HOMA-IR', unit: '', placeholder: 'ex. 1.5' },
  { code: 'HBA1C', label: 'HbA1c', unit: '%', placeholder: 'ex. 5.4' },
  { code: 'B12', label: 'Vitamine B12', unit: 'pg/mL', placeholder: 'ex. 400' },
  { code: 'MAGNESIUM', label: 'Magnésium', unit: 'mg/dL', placeholder: 'ex. 2.0' },
];

// ─── Symptômes catalogue ──────────────────────────────────────────────────
const SYMPTOMS = [
  'Fatigue chronique', 'Troubles digestifs', 'Brouillard mental',
  'Douleurs articulaires', 'Insomnie', 'Anxiété',
  'Prise de poids', 'Perte de cheveux', 'Maux de tête',
  'Acné', 'Constipation', 'Ballonnements',
  'Reflux', 'Crampes', 'Vertiges',
];

// ─── Domaines Roue (4 sliders du wizard) ──────────────────────────────────
const WHEEL_DOMAINS: Array<{ key: string; label: string }> = [
  { key: 'energy', label: WHEEL_LABELS.energy },
  { key: 'inflammation', label: WHEEL_LABELS.inflammation },
  { key: 'stress', label: WHEEL_LABELS.stress },
  { key: 'digestion', label: WHEEL_LABELS.digestion },
];

// ─── Styles partagés ──────────────────────────────────────────────────────
const card: React.CSSProperties = { background: '#fff', borderRadius: 14, border: '1px solid #e8eaf0', padding: 24 };
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 11px', border: '1px solid #e2e8f0',
  borderRadius: 8, fontSize: 14, background: '#fff', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, color: '#475569', marginBottom: 5, fontWeight: 600,
};

// UUID léger (le DTO API exige un UUID pour patient_user_id ; on en génère un
// par défaut pour découpler le flux du compte utilisateur).
function uuidv4(): string {
  // crypto.randomUUID quand dispo, fallback léger sinon.
  const c: any = typeof crypto !== 'undefined' ? crypto : null;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Types ────────────────────────────────────────────────────────────────
type IdentityForm = {
  first_name: string;
  last_name: string;
  gender: '' | 'male' | 'female' | 'other' | 'prefer_not_to_say';
  date_of_birth: string;
  consent: boolean;
};

type StepKey = 1 | 2 | 3 | 4;

// ─── Composant principal ──────────────────────────────────────────────────
export function PatientWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<StepKey>(1);

  // Étape 1 — Identité
  const [identity, setIdentity] = useState<IdentityForm>({
    first_name: '', last_name: '', gender: '', date_of_birth: '', consent: false,
  });

  // Étape 2 — Symptômes
  const [selectedSymptoms, setSelectedSymptoms] = useState<Set<string>>(new Set());
  const [otherSymptoms, setOtherSymptoms] = useState('');

  // Étape 3 — Biomarqueurs
  const [bioMode, setBioMode] = useState<'quick' | 'paste'>('quick');
  const [quickValues, setQuickValues] = useState<Record<string, string>>({});
  const [pasteText, setPasteText] = useState('');
  const [pasteExtractedCount, setPasteExtractedCount] = useState<number | null>(null);
  const [pasteBusy, setPasteBusy] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);

  // Étape 4 — Roue
  const [wheelScores, setWheelScores] = useState<Record<string, number>>({
    energy: 50, inflammation: 50, stress: 50, digestion: 50,
  });

  // Soumission
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ─── Validations ────────────────────────────────────────────────────────
  const step1Valid = useMemo(
    () =>
      identity.first_name.trim().length > 0 &&
      identity.last_name.trim().length > 0 &&
      identity.date_of_birth.length > 0 &&
      identity.consent === true,
    [identity],
  );

  // ─── Navigation ─────────────────────────────────────────────────────────
  function goNext() {
    if (step === 1 && !step1Valid) {
      setSubmitError('Complétez tous les champs obligatoires (étape 1).');
      return;
    }
    setSubmitError(null);
    setStep((s) => (Math.min(4, s + 1) as StepKey));
  }
  function goPrev() {
    setSubmitError(null);
    setStep((s) => (Math.max(1, s - 1) as StepKey));
  }

  // ─── Action symptomes ───────────────────────────────────────────────────
  function toggleSymptom(s: string) {
    setSelectedSymptoms((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  // ─── Action « profil démo » ─────────────────────────────────────────────
  function loadDemoProfile() {
    const values: Record<string, string> = {};
    for (const item of DEMO_PROFILE) values[item.biomarker_code] = String(item.value);
    setQuickValues((prev) => ({ ...prev, ...values }));
    setBioMode('quick');
  }

  // ─── Mode B — extraction bilan collé ────────────────────────────────────
  // NB : on a besoin d'un patientId pour appeler l'API. Si l'utilisateur veut
  // extraire dès l'étape 3, on prévient (le patient sera créé à la soumission
  // finale). Le bilan brut est stocké dans `pasteText` et envoyé après.
  async function extractPasteAfterCreation(patientId: string): Promise<Array<{ biomarker_code: string; value: number }>> {
    if (!pasteText.trim()) return [];
    try {
      const doc = await twinApi.createDocument(patientId, pasteText.trim(), 'Wizard onboarding');
      const docId = doc?.id || doc?.document?.id;
      if (!docId) return [];
      const extracted = await twinApi.extractDocument(patientId, docId);
      // Le service renvoie soit { biomarkers: [...] } soit la liste directement.
      const list: any[] = extracted?.biomarkers || extracted?.items || (Array.isArray(extracted) ? extracted : []);
      return list
        .map((x: any) => ({
          biomarker_code: x.biomarker_code || x.code,
          value: Number(x.value),
        }))
        .filter((x) => x.biomarker_code && Number.isFinite(x.value));
    } catch {
      return [];
    }
  }

  // Tentative d'extraction immédiate (preview) — sans persister.
  async function previewExtractPaste() {
    if (!pasteText.trim()) {
      setPasteError('Collez votre bilan dans la zone ci-dessus.');
      return;
    }
    setPasteBusy(true);
    setPasteError(null);
    setPasteExtractedCount(null);
    try {
      // Heuristique légère côté client : on compte les lignes contenant un
      // nombre suivi d'une unité plausible. L'extraction IA réelle se fera
      // côté backend après création du patient.
      const lines = pasteText.split(/\r?\n/).filter((l) => /\d/.test(l));
      setPasteExtractedCount(lines.length);
    } catch (e: any) {
      setPasteError(e?.message || 'Aperçu indisponible');
    } finally {
      setPasteBusy(false);
    }
  }

  // ─── Création complète ──────────────────────────────────────────────────
  async function handleCreate() {
    if (!step1Valid) {
      setStep(1);
      setSubmitError('Complétez les champs obligatoires (étape 1).');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      // 1) Créer le patient
      const token = localStorage.getItem('supabase_token');
      const headers = {
        Authorization: 'Bearer ' + token,
        'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
        'Content-Type': 'application/json',
      };

      const symptomsList = [
        ...Array.from(selectedSymptoms),
        ...(otherSymptoms.trim() ? [otherSymptoms.trim()] : []),
      ];

      const body: Record<string, unknown> = {
        patient_user_id: uuidv4(),
        first_name: identity.first_name.trim(),
        last_name: identity.last_name.trim(),
        gender: identity.gender || undefined,
        date_of_birth: identity.date_of_birth || undefined,
        consent_given: identity.consent,
        consent_purpose: 'soins_courants',
      };
      if (symptomsList.length > 0) {
        body.medical_history = { chief_complaints: symptomsList };
      }

      const res = await fetch(API + '/med/patients', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.message || `Création patient: erreur ${res.status}`);
      }
      const created = await res.json();
      const patient = created?.data || created;
      const patientId: string | undefined = patient?.id;
      if (!patientId) throw new Error('ID patient introuvable dans la réponse API.');

      // 2) Biomarqueurs
      let biomarkers: Array<{ biomarker_code: string; value: number }> = [];
      if (bioMode === 'quick') {
        biomarkers = Object.entries(quickValues)
          .map(([code, raw]) => ({ biomarker_code: code, value: Number(raw) }))
          .filter((x) => Number.isFinite(x.value));
      } else {
        biomarkers = await extractPasteAfterCreation(patientId);
      }
      if (biomarkers.length > 0) {
        try { await twinApi.addBiomarkers(patientId, biomarkers); } catch { /* non bloquant */ }
      }

      // 3) Roue de transformation
      const wheelPayload = WHEEL_DOMAINS.map((d) => ({
        domain: d.key,
        score: wheelScores[d.key] ?? 50,
      }));
      try { await twinApi.saveWheel(patientId, wheelPayload); } catch { /* non bloquant */ }

      // 4) Redirection vers le jumeau
      navigate(`/twin/${patientId}`);
    } catch (e: any) {
      setSubmitError(e?.message || 'Échec de la création');
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5,
            color: 'var(--brand-primary)', background: 'none', border: 'none',
            padding: 0, cursor: 'pointer', fontWeight: 600,
          }}
        >
          <ChevronLeft size={14} /> Retour
        </button>
        <h2 style={{
          fontSize: 23, fontWeight: 800, margin: '4px 0 0', color: '#0f172a',
          display: 'flex', alignItems: 'center', gap: 9,
        }}>
          <Sparkles size={22} color="var(--brand-primary)" /> Nouveau patient — Onboarding Twin
        </h2>
      </div>

      {/* Stepper */}
      <Stepper currentStep={step} />

      {/* Progress bar */}
      <div style={{ height: 4, background: '#f1f5f9', borderRadius: 4, marginBottom: 20, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${(step / 4) * 100}%`,
          background: 'var(--brand-primary)',
          transition: 'width 200ms ease',
        }} />
      </div>

      {/* Contenu de l'étape */}
      <div style={card}>
        {step === 1 && (
          <Step1Identity identity={identity} setIdentity={setIdentity} />
        )}
        {step === 2 && (
          <Step2Symptoms
            selected={selectedSymptoms}
            onToggle={toggleSymptom}
            other={otherSymptoms}
            setOther={setOtherSymptoms}
          />
        )}
        {step === 3 && (
          <Step3Biomarkers
            mode={bioMode}
            setMode={setBioMode}
            values={quickValues}
            setValues={setQuickValues}
            pasteText={pasteText}
            setPasteText={setPasteText}
            extractedCount={pasteExtractedCount}
            extractBusy={pasteBusy}
            extractError={pasteError}
            onExtract={previewExtractPaste}
            onDemo={loadDemoProfile}
          />
        )}
        {step === 4 && (
          <Step4Wheel scores={wheelScores} setScores={setWheelScores} />
        )}
      </div>

      {/* Erreur */}
      {submitError && (
        <div style={{
          marginTop: 14, padding: 12, background: '#fef2f2', color: '#991b1b',
          borderRadius: 10, fontSize: 13, border: '1px solid #fecaca',
        }}>
          {submitError}
        </div>
      )}

      {/* Boutons de navigation */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 18,
      }}>
        <button
          type="button"
          onClick={goPrev}
          disabled={step === 1 || submitting}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 18px', background: '#fff', color: '#475569',
            border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 13.5,
            fontWeight: 600, cursor: step === 1 || submitting ? 'not-allowed' : 'pointer',
            opacity: step === 1 ? 0.5 : 1,
          }}
        >
          <ChevronLeft size={15} /> Précédent
        </button>
        {step < 4 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={submitting}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 18px', background: 'var(--brand-primary)', color: '#fff',
              border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 600,
              cursor: submitting ? 'wait' : 'pointer',
            }}
          >
            Suivant <ChevronRight size={15} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCreate}
            disabled={submitting}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '10px 18px', background: '#7c3aed', color: '#fff',
              border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 700,
              cursor: submitting ? 'wait' : 'pointer',
            }}
          >
            {submitting ? <Loader2 size={15} className="spin" /> : <Check size={15} />}
            Créer patient + initialiser Twin
          </button>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }`}</style>
    </div>
  );
}

// ─── Stepper ──────────────────────────────────────────────────────────────
function Stepper({ currentStep }: { currentStep: StepKey }) {
  const steps: Array<{ n: StepKey; label: string; Icon: typeof User }> = [
    { n: 1, label: 'Identité', Icon: User },
    { n: 2, label: 'Symptômes', Icon: Stethoscope },
    { n: 3, label: 'Biomarqueurs', Icon: FlaskConical },
    { n: 4, label: 'Roue', Icon: Sparkles },
  ];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14,
      flexWrap: 'wrap',
    }}>
      {steps.map((s, i) => {
        const active = s.n === currentStep;
        const done = s.n < currentStep;
        const color = done ? '#10b981' : active ? 'var(--brand-primary)' : '#cbd5e1';
        const bg = done ? '#d1fae5' : active ? 'var(--brand-primary-soft)' : '#f1f5f9';
        return (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', borderRadius: 10,
              background: bg, color, fontWeight: 700, fontSize: 13,
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: '50%',
                background: color, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11.5, fontWeight: 800,
              }}>
                {done ? <Check size={13} /> : s.n}
              </span>
              <span>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <ChevronRight size={14} color="#cbd5e1" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Étape 1 — Identité + RGPD ────────────────────────────────────────────
function Step1Identity({ identity, setIdentity }: {
  identity: IdentityForm;
  setIdentity: React.Dispatch<React.SetStateAction<IdentityForm>>;
}) {
  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, marginBottom: 14, color: '#0f172a' }}>
        Informations administratives
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <label>
          <span style={labelStyle}>Prénom *</span>
          <input
            required
            value={identity.first_name}
            onChange={(e) => setIdentity({ ...identity, first_name: e.target.value })}
            style={inputStyle}
          />
        </label>
        <label>
          <span style={labelStyle}>Nom *</span>
          <input
            required
            value={identity.last_name}
            onChange={(e) => setIdentity({ ...identity, last_name: e.target.value })}
            style={inputStyle}
          />
        </label>
        <label>
          <span style={labelStyle}>Date de naissance *</span>
          <input
            type="date"
            value={identity.date_of_birth}
            onChange={(e) => setIdentity({ ...identity, date_of_birth: e.target.value })}
            style={inputStyle}
          />
        </label>
        <label>
          <span style={labelStyle}>Genre</span>
          <select
            value={identity.gender}
            onChange={(e) => setIdentity({ ...identity, gender: e.target.value as IdentityForm['gender'] })}
            style={inputStyle}
          >
            <option value="">—</option>
            <option value="female">Femme</option>
            <option value="male">Homme</option>
            <option value="other">Autre</option>
            <option value="prefer_not_to_say">Préfère ne pas dire</option>
          </select>
        </label>
      </div>

      {/* Consentement RGPD */}
      <div style={{
        marginTop: 18, padding: 14, background: '#f0f9ff',
        border: '1px solid #bae6fd', borderRadius: 10,
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <ShieldCheck size={18} color="#0284c7" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={identity.consent}
              onChange={(e) => setIdentity({ ...identity, consent: e.target.checked })}
              style={{ marginTop: 3, width: 16, height: 16, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 13, color: '#0c4a6e', lineHeight: 1.5 }}>
              <strong>Consentement RGPD *</strong> — Le patient autorise la création
              de son dossier médical numérique et le traitement de ses données pour
              les soins courants, conformément à la politique de confidentialité.
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

// ─── Étape 2 — Symptômes ──────────────────────────────────────────────────
function Step2Symptoms({ selected, onToggle, other, setOther }: {
  selected: Set<string>;
  onToggle: (s: string) => void;
  other: string;
  setOther: (s: string) => void;
}) {
  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, marginBottom: 4, color: '#0f172a' }}>
        Symptômes / motif de consultation
      </h3>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>
        Sélectionnez les symptômes rapportés par le patient. Vous pourrez compléter
        plus tard depuis le jumeau numérique.
      </p>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8,
      }}>
        {SYMPTOMS.map((s) => {
          const active = selected.has(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => onToggle(s)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 12px',
                background: active ? 'var(--brand-primary-soft)' : '#f8fafc',
                color: active ? 'var(--brand-primary)' : '#475569',
                border: active ? '1px solid var(--brand-primary)' : '1px solid #e2e8f0',
                borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{
                width: 16, height: 16, borderRadius: 4,
                border: '1.5px solid currentColor',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: active ? 'currentColor' : '#fff', flexShrink: 0,
              }}>
                {active && <Check size={11} color="#fff" />}
              </span>
              {s}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 16 }}>
        <label>
          <span style={labelStyle}>Autres symptômes (texte libre)</span>
          <textarea
            value={other}
            onChange={(e) => setOther(e.target.value)}
            rows={3}
            style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
            placeholder="Décrivez tout autre symptôme, contexte d'apparition, durée…"
          />
        </label>
      </div>
    </div>
  );
}

// ─── Étape 3 — Biomarqueurs ───────────────────────────────────────────────
function Step3Biomarkers({
  mode, setMode, values, setValues,
  pasteText, setPasteText, extractedCount, extractBusy, extractError,
  onExtract, onDemo,
}: {
  mode: 'quick' | 'paste';
  setMode: (m: 'quick' | 'paste') => void;
  values: Record<string, string>;
  setValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  pasteText: string;
  setPasteText: (t: string) => void;
  extractedCount: number | null;
  extractBusy: boolean;
  extractError: string | null;
  onExtract: () => void;
  onDemo: () => void;
}) {
  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        gap: 12, marginBottom: 14, flexWrap: 'wrap',
      }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#0f172a' }}>
            Biomarqueurs initiaux
          </h3>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
            Optionnel — alimente immédiatement le jumeau numérique.
          </p>
        </div>
        <button
          type="button"
          onClick={onDemo}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', background: '#fff', color: '#7c3aed',
            border: '1px dashed #c4b5fd', borderRadius: 9, fontSize: 12.5,
            fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Zap size={14} /> Charger un profil démo
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: '#f1f5f9', padding: 4, borderRadius: 10 }}>
        {(['quick', 'paste'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            style={{
              flex: 1, padding: '8px 14px', borderRadius: 8, border: 'none',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: mode === m ? '#fff' : 'transparent',
              color: mode === m ? 'var(--brand-primary)' : '#64748b',
              boxShadow: mode === m ? '0 1px 3px rgba(15,23,42,0.12)' : 'none',
            }}
          >
            {m === 'quick' ? 'Saisie rapide' : 'Coller un bilan'}
          </button>
        ))}
      </div>

      {mode === 'quick' && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12,
        }}>
          {QUICK_BIOMARKERS.map((b) => (
            <label key={b.code}>
              <span style={labelStyle}>
                {b.label} {b.unit && <span style={{ color: '#94a3b8', fontWeight: 500 }}>({b.unit})</span>}
              </span>
              <input
                type="number"
                step="any"
                placeholder={b.placeholder}
                value={values[b.code] || ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [b.code]: e.target.value }))}
                style={inputStyle}
              />
            </label>
          ))}
        </div>
      )}

      {mode === 'paste' && (
        <div>
          <label>
            <span style={labelStyle}>Bilan biologique brut (copier-coller)</span>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={8}
              style={{ ...inputStyle, fontFamily: 'ui-monospace, monospace', resize: 'vertical', fontSize: 12.5 }}
              placeholder={'Exemple :\nTSH    3.2 mUI/L\nVitamine D    21 ng/mL\nFerritine    255 µg/L\n…'}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onExtract}
              disabled={extractBusy || !pasteText.trim()}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', background: '#7c3aed', color: '#fff',
                border: 'none', borderRadius: 9, fontSize: 12.5, fontWeight: 600,
                cursor: extractBusy || !pasteText.trim() ? 'not-allowed' : 'pointer',
                opacity: !pasteText.trim() ? 0.5 : 1,
              }}
            >
              {extractBusy ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />}
              Extraire avec IA
            </button>
            {extractedCount !== null && (
              <span style={{ fontSize: 12.5, color: '#10b981', fontWeight: 600 }}>
                <Check size={13} style={{ verticalAlign: -2 }} /> {extractedCount} ligne(s) détectée(s) — extraction finalisée à la création.
              </span>
            )}
            {extractError && (
              <span style={{ fontSize: 12.5, color: '#dc2626' }}>{extractError}</span>
            )}
          </div>
          <p style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 10 }}>
            Le bilan sera envoyé au moteur d'extraction IA lors de la création du patient.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Étape 4 — Roue de transformation ─────────────────────────────────────
function Step4Wheel({ scores, setScores }: {
  scores: Record<string, number>;
  setScores: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}) {
  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, marginBottom: 4, color: '#0f172a' }}>
        Roue de transformation — état initial
      </h3>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 18 }}>
        Optionnel — Évaluez de 0 (problématique) à 100 (optimal) sur chaque domaine.
        Vous pouvez passer cette étape, des valeurs neutres seront utilisées.
      </p>
      <div style={{ display: 'grid', gap: 16 }}>
        {WHEEL_DOMAINS.map((d) => {
          const v = scores[d.key] ?? 50;
          const color = v >= 75 ? '#10b981' : v >= 50 ? '#eab308' : v >= 25 ? '#f97316' : '#ef4444';
          return (
            <div key={d.key}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                marginBottom: 6,
              }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: '#1e293b' }}>{d.label}</span>
                <span style={{ fontSize: 16, fontWeight: 800, color }}>{v} <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>/100</span></span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={v}
                onChange={(e) => setScores((prev) => ({ ...prev, [d.key]: Number(e.target.value) }))}
                style={{ width: '100%', accentColor: color }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
