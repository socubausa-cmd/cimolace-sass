/**
 * LiriMobileMoneySettings — encaissement Mobile Money (PawaPay) self-service du tenant.
 *
 * Comble le trou n°1 de l'audit encaissements : le backend tenant-payment-config
 * supporte DÉJÀ pawapay (credentials {api_token, signing_secret} chiffrés AES-256-GCM
 * dans tenant_payment_providers, test réel GET /v2/active-conf, résolution par le
 * checkout élève offering-checkout) — il n'existait AUCUNE UI pour le configurer.
 *
 * Pattern identique à la section Stripe de LiriAccountPage (état connecté/formulaire,
 * classes chaudes lp-*), IN-REALM LIRI. API : paymentMethodsApi (api-v2).
 * À monter dans la section « Encaissements » du hub compte (LiriAccountPage).
 */
import { useEffect, useState } from 'react';
import { Smartphone, Loader2, Check, ShieldCheck, AlertCircle } from 'lucide-react';
import { paymentMethodsApi } from '@/lib/api-v2';

export default function LiriMobileMoneySettings() {
  const [state, setState] = useState({ loading: true, set: false, enabled: false, last4: '', mode: 'live' });
  const [reconfig, setReconfig] = useState(false);
  const [apiToken, setApiToken] = useState('');
  const [signingSecret, setSigningSecret] = useState('');
  const [mode, setMode] = useState('live');
  const [busy, setBusy] = useState(null); // 'save' | 'test' | 'toggle'
  const [msg, setMsg] = useState(null); // {ok, text}

  const load = () =>
    paymentMethodsApi.list()
      .then((d) => {
        const row = (d?.providers ?? []).find((p) => p.provider === 'pawapay');
        setState({
          loading: false,
          set: !!row?.set,
          enabled: !!row?.enabled,
          last4: row?.last4 || '',
          mode: row?.mode || 'live',
        });
      })
      .catch(() => setState((s) => ({ ...s, loading: false })));

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!apiToken.trim()) { setMsg({ ok: false, text: 'Le token API PawaPay est requis.' }); return; }
    setBusy('save'); setMsg(null);
    try {
      await paymentMethodsApi.save({
        provider: 'pawapay',
        mode,
        credentials: { api_token: apiToken.trim(), ...(signingSecret.trim() ? { signing_secret: signingSecret.trim() } : {}) },
      });
      setApiToken(''); setSigningSecret(''); setReconfig(false);
      setMsg({ ok: true, text: 'Mobile Money connecté — vos élèves peuvent payer en Orange Money, MTN MoMo, Moov…' });
      await load();
    } catch (e) { setMsg({ ok: false, text: e?.message || 'Enregistrement impossible.' }); }
    finally { setBusy(null); }
  };

  const test = async () => {
    setBusy('test'); setMsg(null);
    try {
      const r = await paymentMethodsApi.test('pawapay');
      setMsg({ ok: !!r?.ok, text: r?.message || (r?.ok ? 'Connexion PawaPay OK.' : 'Test échoué.') });
    } catch (e) { setMsg({ ok: false, text: e?.message || 'Test impossible.' }); }
    finally { setBusy(null); }
  };

  const toggle = async () => {
    setBusy('toggle'); setMsg(null);
    try { await paymentMethodsApi.toggle('pawapay', !state.enabled); await load(); }
    catch (e) { setMsg({ ok: false, text: e?.message || 'Changement impossible.' }); }
    finally { setBusy(null); }
  };

  if (state.loading) {
    return <div className="mt-5 flex items-center gap-2 text-[13px] lp-faint"><Loader2 size={15} className="animate-spin" /> Chargement Mobile Money…</div>;
  }

  return (
    <div className="mt-5 rounded-2xl border lp-line lp-panel70 p-5">
      {state.set && !reconfig ? (
        <>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: 'rgba(91,122,82,.16)' }}>
              <Smartphone size={18} style={{ color: '#7bbf6a' }} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium lp-ink">Mobile Money connecté (PawaPay)</p>
              <p className="mt-0.5 text-[12.5px] lp-faint">
                Token •••• {state.last4 || '••••'} · chiffré en base · {state.mode === 'sandbox' ? 'sandbox' : 'live'}{state.enabled ? '' : ' · désactivé'}
              </p>
            </div>
          </div>
          {msg && <p className="mt-3 text-[12.5px]" style={{ color: msg.ok ? '#7bbf6a' : '#ef6a52' }}>{msg.text}</p>}
          <div className="mt-4 flex flex-wrap gap-2.5">
            <button onClick={test} disabled={busy === 'test'} className="flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[12.5px] font-medium lp-tr disabled:opacity-60" style={{ color: '#cfcac4', borderColor: 'rgba(245,244,238,.14)' }}>
              {busy === 'test' ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} Tester la connexion
            </button>
            <button onClick={toggle} disabled={busy === 'toggle'} className="flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[12.5px] font-medium lp-tr disabled:opacity-60" style={{ color: '#cfcac4', borderColor: 'rgba(245,244,238,.14)' }}>
              {busy === 'toggle' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {state.enabled ? 'Désactiver' : 'Activer'}
            </button>
            <button onClick={() => { setReconfig(true); setMsg(null); }} className="rounded-lg border px-3.5 py-2 text-[12.5px] font-medium lp-tr" style={{ color: '#cfcac4', borderColor: 'rgba(245,244,238,.14)' }}>
              Reconfigurer
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2.5">
            <Smartphone size={18} className="lp-coral shrink-0" />
            <p className="text-[14px] font-medium lp-ink">Encaisser en Mobile Money (Afrique)</p>
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed lp-faint">
            Orange Money · MTN MoMo · Moov · Wave… Collez votre <strong>token API PawaPay</strong> (dashboard.pawapay.io → API Tokens) —
            vos élèves paieront directement sur votre compte marchand.
          </p>
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-[11px] lp-faint">Token API PawaPay</span>
              <input
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder="eyJhbGciOi…"
                type="password"
                autoComplete="off"
                className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-sm lp-ink"
                style={{ borderColor: 'rgba(245,244,238,.14)' }}
              />
            </label>
            <label className="block">
              <span className="text-[11px] lp-faint">Signing secret (optionnel — vérification des callbacks)</span>
              <input
                value={signingSecret}
                onChange={(e) => setSigningSecret(e.target.value)}
                placeholder="—"
                type="password"
                autoComplete="off"
                className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-sm lp-ink"
                style={{ borderColor: 'rgba(245,244,238,.14)' }}
              />
            </label>
            <div className="flex items-center gap-2 text-[12.5px] lp-faint">
              <span>Mode :</span>
              {['live', 'sandbox'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-full border px-3 py-1 text-[12px] font-medium lp-tr ${mode === m ? 'text-white' : ''}`}
                  style={mode === m ? { background: '#d97757', borderColor: '#d97757' } : { color: '#cfcac4', borderColor: 'rgba(245,244,238,.14)' }}
                >
                  {m === 'live' ? 'Production' : 'Sandbox (test)'}
                </button>
              ))}
            </div>
            {msg && (
              <p className="flex items-start gap-1.5 text-[12.5px]" style={{ color: msg.ok ? '#7bbf6a' : '#ef6a52' }}>
                {!msg.ok && <AlertCircle size={14} className="mt-0.5 shrink-0" />}{msg.text}
              </p>
            )}
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={save}
                disabled={busy === 'save' || !apiToken.trim()}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white lp-tr disabled:opacity-50"
                style={{ background: '#d97757' }}
              >
                {busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Smartphone size={14} />} Connecter Mobile Money
              </button>
              {state.set && (
                <button onClick={() => { setReconfig(false); setMsg(null); }} className="rounded-lg border px-3.5 py-2 text-[12.5px] font-medium lp-tr" style={{ color: '#cfcac4', borderColor: 'rgba(245,244,238,.14)' }}>
                  Annuler
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
