/**
 * ═══════════════════════════════════════════════════════════════
 * CREATE SCHOOL — Wizard self-service pour créer une école Cimolace
 * Étape 1 : Identité  |  Étape 2 : Personnalisation  |  Étape 3 : Confirmation
 * ═══════════════════════════════════════════════════════════════
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import CimolaceHeader from '@/components/cimolace/Header';
import CimolaceSidebar from '@/components/cimolace/Sidebar';
import { schoolOnboardingApi } from '@/lib/api-v2';

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 64);
}

// ── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: '#f3f4f6',
  },
  body: {
    display: 'flex',
    flex: 1,
  },
  main: {
    flex: 1,
    padding: '32px',
    overflowY: 'auto',
  },
  panel: {
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '32px',
    maxWidth: '640px',
    margin: '0 auto',
  },
  title: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#111827',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '28px',
  },
  stepRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '28px',
  },
  stepBadge: (active, done) => ({
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: '700',
    backgroundColor: done ? '#10b981' : active ? '#3b82f6' : '#e5e7eb',
    color: done || active ? '#ffffff' : '#6b7280',
  }),
  stepLabel: (active) => ({
    fontSize: '13px',
    fontWeight: active ? '600' : '400',
    color: active ? '#111827' : '#9ca3af',
  }),
  stepDivider: {
    flex: 1,
    height: '1px',
    backgroundColor: '#e5e7eb',
  },
  field: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    color: '#111827',
    outline: 'none',
    boxSizing: 'border-box',
    backgroundColor: '#ffffff',
  },
  inputError: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ef4444',
    borderRadius: '6px',
    fontSize: '14px',
    color: '#111827',
    outline: 'none',
    boxSizing: 'border-box',
    backgroundColor: '#fff5f5',
  },
  hint: {
    fontSize: '12px',
    color: '#9ca3af',
    marginTop: '4px',
  },
  errorText: {
    fontSize: '12px',
    color: '#ef4444',
    marginTop: '4px',
  },
  colorRow: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
  },
  colorField: {
    flex: '1',
    minWidth: '140px',
  },
  colorInputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  colorSwatch: {
    width: '36px',
    height: '36px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    cursor: 'pointer',
    padding: '2px',
    backgroundColor: 'transparent',
  },
  colorHex: {
    flex: 1,
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#111827',
    fontFamily: 'monospace',
    outline: 'none',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    color: '#111827',
    outline: 'none',
    boxSizing: 'border-box',
    backgroundColor: '#ffffff',
  },
  actionRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '28px',
    paddingTop: '20px',
    borderTop: '1px solid #e5e7eb',
  },
  btnPrimary: (disabled) => ({
    padding: '10px 24px',
    backgroundColor: disabled ? '#93c5fd' : '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: disabled ? 'not-allowed' : 'pointer',
  }),
  btnSecondary: {
    padding: '10px 24px',
    backgroundColor: 'transparent',
    color: '#6b7280',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  btnDanger: (disabled) => ({
    padding: '10px 24px',
    backgroundColor: disabled ? '#fca5a5' : '#ef4444',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: disabled ? 'not-allowed' : 'pointer',
  }),
  btnSuccess: (disabled) => ({
    padding: '10px 24px',
    backgroundColor: disabled ? '#6ee7b7' : '#10b981',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: disabled ? 'not-allowed' : 'pointer',
  }),
  errorBox: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    padding: '12px 16px',
    color: '#b91c1c',
    fontSize: '13px',
    marginBottom: '20px',
  },
  successBox: {
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '8px',
    padding: '24px',
    marginTop: '0',
  },
  successTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#15803d',
    marginBottom: '12px',
  },
  successRow: {
    fontSize: '14px',
    color: '#166534',
    marginBottom: '8px',
  },
  successLink: {
    display: 'inline-block',
    marginTop: '12px',
    padding: '10px 20px',
    backgroundColor: '#10b981',
    color: '#ffffff',
    borderRadius: '6px',
    textDecoration: 'none',
    fontWeight: '600',
    fontSize: '14px',
  },
  previewBox: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    padding: '16px',
    marginBottom: '20px',
    fontSize: '13px',
    color: '#374151',
  },
  previewTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#111827',
    marginBottom: '8px',
  },
  previewList: {
    paddingLeft: '16px',
    margin: '0 0 8px 0',
  },
  confirmField: {
    marginBottom: '16px',
  },
  confirmLabel: {
    display: 'block',
    fontSize: '13px',
    color: '#374151',
    marginBottom: '6px',
  },
  warningBox: {
    backgroundColor: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: '6px',
    padding: '12px 16px',
    color: '#92400e',
    fontSize: '13px',
    marginBottom: '16px',
  },
};

// ── Wizard steps ─────────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Identité' },
  { label: 'Personnalisation' },
  { label: 'Confirmation' },
];

const INITIAL_FORM = {
  name: '',
  slug: '',
  owner_email: '',
  business_name: '',
  domain: '',
  plan: 'school',
  primary: '#0b1115',
  secondary: '#162331',
  accent: '#d4af37',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function CreateSchoolPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState(INITIAL_FORM);
  const [autoSlug, setAutoSlug] = useState(''); // last auto-generated slug
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [apiError, setApiError] = useState('');
  const [preview, setPreview] = useState(null);
  const [confirmSlug, setConfirmSlug] = useState('');
  const [created, setCreated] = useState(null);

  // ── Field helpers ──────────────────────────────────────────────────────────

  const set = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  }, []);

  const handleNameChange = useCallback((value) => {
    const auto = slugify(value);
    setForm((prev) => {
      const shouldAutoSlug = prev.slug === '' || prev.slug === autoSlug;
      return {
        ...prev,
        name: value,
        slug: shouldAutoSlug ? auto : prev.slug,
      };
    });
    setAutoSlug(auto);
    setErrors((prev) => ({ ...prev, name: '', slug: '' }));
  }, [autoSlug]);

  // ── Validation ─────────────────────────────────────────────────────────────

  function validateStep0() {
    const e = {};
    if (!form.name.trim()) e.name = 'Nom requis';
    if (!form.slug.trim()) e.slug = 'Slug requis';
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim()))
      e.slug = 'Slug invalide : minuscules, chiffres et tirets uniquement';
    if (!form.owner_email.trim()) e.owner_email = "Email propriétaire requis";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.owner_email.trim()))
      e.owner_email = "Email invalide";
    return e;
  }

  function validateStep1() {
    return {};
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  function handleNext() {
    setApiError('');
    const e = step === 0 ? validateStep0() : step === 1 ? validateStep1() : {};
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    setStep((s) => s + 1);
    setPreview(null);
    setConfirmSlug('');
  }

  function handleBack() {
    setApiError('');
    setStep((s) => s - 1);
  }

  // ── Build payload ──────────────────────────────────────────────────────────

  function buildPayload() {
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      owner_email: form.owner_email.trim(),
      plan: form.plan,
      brand_colors: {
        primary: form.primary,
        secondary: form.secondary,
        accent: form.accent,
      },
    };
    if (form.business_name.trim()) payload.business_name = form.business_name.trim();
    if (form.domain.trim()) payload.domain = form.domain.trim();
    return payload;
  }

  // ── Preview ────────────────────────────────────────────────────────────────

  async function handlePreview() {
    setApiError('');
    setBusy(true);
    try {
      const result = await schoolOnboardingApi.previewProvision(buildPayload());
      setPreview(result);
    } catch (err) {
      setApiError(err.message || 'Erreur lors de la prévisualisation');
    } finally {
      setBusy(false);
    }
  }

  // ── Provision ──────────────────────────────────────────────────────────────

  async function handleProvision() {
    setApiError('');
    if (confirmSlug !== form.slug.trim()) {
      setApiError('Le slug de confirmation ne correspond pas.');
      return;
    }
    setBusy(true);
    try {
      const result = await schoolOnboardingApi.provision(buildPayload());
      setCreated(result);
    } catch (err) {
      setApiError(err.message || 'Erreur lors de la création');
    } finally {
      setBusy(false);
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  function handleReset() {
    setForm(INITIAL_FORM);
    setAutoSlug('');
    setErrors({});
    setApiError('');
    setPreview(null);
    setConfirmSlug('');
    setCreated(null);
    setStep(0);
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const slugBlocked = preview
    ? (preview.warnings || []).some((w) =>
        w.toLowerCase().includes('déjà pris') || w.toLowerCase().includes('deja pris')
      )
    : false;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={S.page}>
      <CimolaceHeader />
      <div style={S.body}>
        <CimolaceSidebar />
        <main style={S.main}>
          <div style={S.panel}>
            {/* Step indicator */}
            <div style={S.stepRow}>
              {STEPS.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={S.stepBadge(step === i, step > i)}>
                      {step > i ? '✓' : i + 1}
                    </div>
                    <span style={S.stepLabel(step === i)}>{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && <div style={S.stepDivider} />}
                </div>
              ))}
            </div>

            {/* ── Success state ────────────────────────────────────────── */}
            {created && (
              <div style={S.successBox}>
                <div style={S.successTitle}>École créée avec succès !</div>
                <div style={S.successRow}>
                  <strong>Nom :</strong> {created.school?.name || form.name}
                </div>
                <div style={S.successRow}>
                  <strong>Slug :</strong> {created.school?.slug || form.slug}
                </div>
                <div style={{ marginTop: '16px' }}>
                  <a
                    href={`/t/${created.school?.slug || form.slug}/admin`}
                    style={S.successLink}
                  >
                    Accéder à mon école
                  </a>
                </div>
                <div style={{ marginTop: '16px' }}>
                  <button onClick={handleReset} style={S.btnSecondary}>
                    Créer une autre école
                  </button>
                </div>
              </div>
            )}

            {!created && (
              <>
                {/* ── Step 0 — Identité ──────────────────────────────── */}
                {step === 0 && (
                  <>
                    <div style={S.title}>Identité de l'école</div>
                    <div style={S.subtitle}>
                      Donnez un nom à votre école et choisissez son identifiant unique.
                    </div>

                    {apiError && <div style={S.errorBox}>{apiError}</div>}

                    <div style={S.field}>
                      <label style={S.label}>Nom de l'école *</label>
                      <input
                        style={errors.name ? S.inputError : S.input}
                        type="text"
                        placeholder="Ex : École Fatima"
                        value={form.name}
                        onChange={(e) => handleNameChange(e.target.value)}
                      />
                      {errors.name && <div style={S.errorText}>{errors.name}</div>}
                    </div>

                    <div style={S.field}>
                      <label style={S.label}>Slug (identifiant URL) *</label>
                      <input
                        style={errors.slug ? S.inputError : S.input}
                        type="text"
                        placeholder="ecole-fatima"
                        value={form.slug}
                        onChange={(e) => {
                          set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                        }}
                      />
                      {errors.slug
                        ? <div style={S.errorText}>{errors.slug}</div>
                        : <div style={S.hint}>Minuscules, chiffres et tirets. Ex : ecole-fatima</div>
                      }
                    </div>

                    <div style={S.field}>
                      <label style={S.label}>Email du propriétaire *</label>
                      <input
                        style={errors.owner_email ? S.inputError : S.input}
                        type="email"
                        placeholder="admin@monecole.org"
                        value={form.owner_email}
                        onChange={(e) => set('owner_email', e.target.value)}
                      />
                      {errors.owner_email && (
                        <div style={S.errorText}>{errors.owner_email}</div>
                      )}
                    </div>

                    <div style={S.actionRow}>
                      <div />
                      <button
                        style={S.btnPrimary(false)}
                        onClick={handleNext}
                      >
                        Suivant →
                      </button>
                    </div>
                  </>
                )}

                {/* ── Step 1 — Personnalisation ──────────────────────── */}
                {step === 1 && (
                  <>
                    <div style={S.title}>Personnalisation</div>
                    <div style={S.subtitle}>
                      Configurez l'apparence et le plan de votre école.
                    </div>

                    {apiError && <div style={S.errorBox}>{apiError}</div>}

                    <div style={S.field}>
                      <label style={S.label}>Raison sociale</label>
                      <input
                        style={S.input}
                        type="text"
                        placeholder="SARL École Fatima"
                        value={form.business_name}
                        onChange={(e) => set('business_name', e.target.value)}
                      />
                    </div>

                    <div style={S.field}>
                      <label style={S.label}>Domaine</label>
                      <input
                        style={S.input}
                        type="text"
                        placeholder={`${form.slug || 'mon-ecole'}.prorascience.org`}
                        value={form.domain}
                        onChange={(e) => set('domain', e.target.value)}
                      />
                      <div style={S.hint}>Laissez vide pour utiliser le sous-domaine par défaut.</div>
                    </div>

                    <div style={S.field}>
                      <label style={S.label}>Couleurs de marque</label>
                      <div style={S.colorRow}>
                        {[
                          { key: 'primary', label: 'Primaire' },
                          { key: 'secondary', label: 'Secondaire' },
                          { key: 'accent', label: 'Accent' },
                        ].map(({ key, label }) => (
                          <div key={key} style={S.colorField}>
                            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>
                              {label}
                            </div>
                            <div style={S.colorInputRow}>
                              <input
                                type="color"
                                style={S.colorSwatch}
                                value={form[key]}
                                onChange={(e) => set(key, e.target.value)}
                              />
                              <input
                                type="text"
                                style={S.colorHex}
                                value={form[key]}
                                maxLength={7}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (/^#[0-9a-fA-F]{0,6}$/.test(val)) set(key, val);
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={S.field}>
                      <label style={S.label}>Plan</label>
                      <select
                        style={S.select}
                        value={form.plan}
                        onChange={(e) => set('plan', e.target.value)}
                      >
                        <option value="school">School</option>
                        <option value="platform">Platform</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </div>

                    <div style={S.actionRow}>
                      <button style={S.btnSecondary} onClick={handleBack}>
                        ← Retour
                      </button>
                      <button style={S.btnPrimary(false)} onClick={handleNext}>
                        Suivant →
                      </button>
                    </div>
                  </>
                )}

                {/* ── Step 2 — Confirmation ──────────────────────────── */}
                {step === 2 && (
                  <>
                    <div style={S.title}>Confirmation</div>
                    <div style={S.subtitle}>
                      Vérifiez votre configuration puis créez votre école.
                    </div>

                    {apiError && <div style={S.errorBox}>{apiError}</div>}

                    {/* Summary */}
                    <div style={S.previewBox}>
                      <div style={S.previewTitle}>Récapitulatif</div>
                      <div><strong>Nom :</strong> {form.name}</div>
                      <div><strong>Slug :</strong> {form.slug}</div>
                      <div><strong>Owner :</strong> {form.owner_email}</div>
                      <div><strong>Plan :</strong> {form.plan}</div>
                      {form.domain && <div><strong>Domaine :</strong> {form.domain}</div>}
                    </div>

                    {/* Preview result */}
                    {preview && (
                      <div style={S.previewBox}>
                        <div style={S.previewTitle}>Plan de provisioning</div>
                        {preview.owner_method && (
                          <div style={{ marginBottom: '6px' }}>
                            <strong>Méthode owner :</strong> {preview.owner_method}
                          </div>
                        )}
                        {preview.steps && preview.steps.length > 0 && (
                          <>
                            <div><strong>Étapes :</strong></div>
                            <ul style={S.previewList}>
                              {preview.steps.map((s, i) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ul>
                          </>
                        )}
                        {preview.engines && preview.engines.length > 0 && (
                          <>
                            <div><strong>Moteurs activés ({preview.engines.length}) :</strong></div>
                            <ul style={S.previewList}>
                              {preview.engines.map((e, i) => (
                                <li key={i}>{e.label || e.key || e}</li>
                              ))}
                            </ul>
                          </>
                        )}
                        {preview.warnings && preview.warnings.length > 0 && (
                          <div style={{ marginTop: '8px' }}>
                            {preview.warnings.map((w, i) => (
                              <div key={i} style={S.warningBox}>⚠ {w}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Preview button */}
                    {!preview && (
                      <div style={{ marginBottom: '20px' }}>
                        <button
                          style={S.btnPrimary(busy)}
                          disabled={busy}
                          onClick={handlePreview}
                        >
                          {busy ? 'Chargement...' : 'Prévisualiser le plan'}
                        </button>
                      </div>
                    )}

                    {/* Slug confirmation */}
                    {preview && !slugBlocked && (
                      <div style={S.confirmField}>
                        <label style={S.confirmLabel}>
                          Tapez <strong>{form.slug}</strong> pour confirmer la création :
                        </label>
                        <input
                          style={S.input}
                          type="text"
                          placeholder={form.slug}
                          value={confirmSlug}
                          onChange={(e) => setConfirmSlug(e.target.value)}
                        />
                      </div>
                    )}

                    {slugBlocked && (
                      <div style={S.errorBox}>
                        Ce slug est déjà pris. Retournez à l'étape 1 et choisissez un autre slug.
                      </div>
                    )}

                    <div style={S.actionRow}>
                      <button style={S.btnSecondary} onClick={handleBack} disabled={busy}>
                        ← Retour
                      </button>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        {preview && (
                          <button
                            style={S.btnSecondary}
                            onClick={handlePreview}
                            disabled={busy}
                          >
                            Rafraîchir
                          </button>
                        )}
                        {preview && !slugBlocked && (
                          <button
                            style={S.btnSuccess(busy || confirmSlug !== form.slug.trim())}
                            disabled={busy || confirmSlug !== form.slug.trim()}
                            onClick={handleProvision}
                          >
                            {busy ? 'Création...' : 'Créer mon école'}
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
