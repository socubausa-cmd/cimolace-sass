import { useCallback, useEffect, useState } from 'react';
import CimolaceHeader from '@/components/cimolace/Header';
import CimolaceSidebar from '@/components/cimolace/Sidebar';
import { supabase } from '@/lib/customSupabaseClient';

// Palette back-office (cohérente avec /cimolace/admin).
const C = {
  bg: '#0d1117', panel: '#161b22', panel2: '#1c2128', border: '#21262d', border2: '#30363d',
  violet: '#7c3aed', green: '#10b981', orange: '#f59e0b', red: '#ef4444', blue: '#3b82f6',
  text: '#f0f6fc', muted: '#8b949e', muted2: '#6e7681',
};

const PROVIDER_HINTS = {
  deepseek: 'Économie — travail de fond + réponses rapides. Clé sur platform.deepseek.com.',
  mistral: 'Économie EU — texte + vision (Pixtral) + images. Clé sur console.mistral.ai.',
  anthropic: 'Premium — Claude. Nécessite des crédits sur console.anthropic.com.',
  openai: 'Premium — GPT / DALL·E. Clé sur platform.openai.com.',
  xai: 'Repli — Grok. Clé sur console.x.ai.',
  gemini: 'Images Imagen + vision. Clé sur aistudio.google.com.',
};

const MODEL_HINTS = {
  DEEPSEEK_HEAVY_MODEL: 'Modèle DeepSeek « fond » (défaut deepseek-chat)',
  DEEPSEEK_FAST_MODEL: 'Modèle DeepSeek « rapide » (défaut deepseek-chat)',
  MISTRAL_VISION_MODEL: 'Modèle vision Mistral (défaut pixtral-12b-2409)',
  SMARTBOARD_CLAUDE_MODEL: 'Modèle Claude premium (défaut claude-haiku-4-5)',
};

async function callApi(body) {
  const { data, error } = await supabase.functions.invoke('platform-ai-keys', { body });
  if (error) {
    // L'erreur peut porter un corps JSON (403/400/502) — on tente de l'extraire.
    let msg = error.message || 'Erreur';
    try {
      const ctx = await error.context?.json?.();
      if (ctx?.error) msg = ctx.error;
    } catch { /* noop */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data || {};
}

function StatusPill({ ok, label }) {
  const color = ok ? C.green : C.muted2;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600,
      color, border: `1px solid ${ok ? 'rgba(16,185,129,.35)' : C.border2}`,
      background: ok ? 'rgba(16,185,129,.08)' : 'transparent', borderRadius: 999, padding: '2px 8px',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: color }} />
      {label}
    </span>
  );
}

function ProviderRow({ p, onSaved }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(null); // 'test' | 'save' | 'delete'
  const [test, setTest] = useState(null); // { ok, status, error }
  const [msg, setMsg] = useState(null);

  const doTest = async () => {
    setBusy('test'); setTest(null); setMsg(null);
    try {
      const r = await callApi({ action: 'test', provider: p.key, value });
      setTest(r);
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
    finally { setBusy(null); }
  };
  const doSave = async () => {
    setBusy('save'); setMsg(null);
    try {
      await callApi({ action: 'set', name: p.secret, value });
      setValue(''); setTest(null);
      setMsg({ type: 'ok', text: 'Clé enregistrée (secret Supabase posé).' });
      onSaved?.();
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
    finally { setBusy(null); }
  };
  const doDelete = async () => {
    setBusy('delete'); setMsg(null);
    try {
      await callApi({ action: 'delete', name: p.secret });
      setMsg({ type: 'ok', text: 'Secret supprimé.' });
      onSaved?.();
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
    finally { setBusy(null); }
  };

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border2}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{p.label}</div>
        <StatusPill ok={p.set} label={p.set ? 'Configurée' : 'Absente'} />
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>
        {PROVIDER_HINTS[p.key]} <span style={{ color: C.muted2 }}>· secret <code>{p.secret}</code></span>
        {p.set && p.digest ? <span style={{ color: C.muted2 }}> · empreinte {String(p.digest).slice(0, 10)}…</span> : null}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={p.set ? 'Coller une nouvelle clé pour remplacer…' : 'Coller la clé API…'}
          autoComplete="off"
          style={{
            flex: 1, minWidth: 220, background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 8,
            padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'monospace',
          }}
        />
        <button onClick={doTest} disabled={!value.trim() || busy}
          style={btn(C.blue, !value.trim() || busy)}>
          {busy === 'test' ? '…' : 'Tester'}
        </button>
        <button onClick={doSave} disabled={!value.trim() || busy}
          style={btn(C.green, !value.trim() || busy)}>
          {busy === 'save' ? '…' : 'Enregistrer'}
        </button>
        {p.set ? (
          <button onClick={doDelete} disabled={busy} style={btn(C.red, busy, true)}>
            {busy === 'delete' ? '…' : 'Supprimer'}
          </button>
        ) : null}
      </div>
      {test ? (
        <div style={{ marginTop: 10, fontSize: 12, color: test.ok ? C.green : C.red }}>
          {test.ok
            ? '✓ Clé valide — le fournisseur répond.'
            : `✗ Échec${test.status ? ` (${test.status})` : ''} : ${test.error || 'non joignable'}`}
        </div>
      ) : null}
      {msg ? (
        <div style={{ marginTop: 8, fontSize: 12, color: msg.type === 'ok' ? C.green : C.red }}>{msg.text}</div>
      ) : null}
    </div>
  );
}

function btn(color, disabled, outline) {
  return {
    padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
    border: `1px solid ${outline ? 'rgba(239,68,68,.4)' : color}`,
    background: outline ? 'transparent' : color, color: outline ? color : '#fff',
    opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap',
  };
}

function ModelRow({ m, onSaved }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await callApi({ action: 'set', name: m.name, value }); setValue(''); onSaved?.(); }
    catch (e) { alert(e.message); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 220 }}>
        <div style={{ fontSize: 13, color: C.text, fontFamily: 'monospace' }}>{m.name}</div>
        <div style={{ fontSize: 11, color: C.muted2 }}>{MODEL_HINTS[m.name]}{m.set ? ` · actuel: ${m.value || '—'}` : ''}</div>
      </div>
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="ex. deepseek-chat"
        style={{ flex: 1, minWidth: 160, background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 8, padding: '7px 10px', color: C.text, fontSize: 12 }} />
      <button onClick={save} disabled={!value.trim() || busy} style={btn(C.violet, !value.trim() || busy)}>
        {busy ? '…' : 'Définir'}
      </button>
    </div>
  );
}

export default function CimolaceAdminAiKeys() {
  const [state, setState] = useState({ loading: true, error: null, mgmtConfigured: true, providers: [], models: [] });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const r = await callApi({ action: 'list' });
      setState({ loading: false, error: null, mgmtConfigured: r.mgmtConfigured !== false, providers: r.providers || [], models: r.models || [] });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message }));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
      <CimolaceHeader />
      <div style={{ display: 'flex' }}>
        <CimolaceSidebar />
        <main style={{ flex: 1, padding: '24px 28px', maxWidth: 920 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>🔑 Clés IA — Paramétrage LIRI</h1>
          <p style={{ color: C.muted, fontSize: 13, margin: '0 0 20px' }}>
            Saisis les clés API des fournisseurs IA. Elles sont posées comme <b>secrets Supabase</b> (chiffrés par Supabase) ;
            les fonctions IA les lisent automatiquement. Éco par défaut = DeepSeek/Mistral ; Premium = Claude/OpenAI.
          </p>

          {!state.mgmtConfigured ? (
            <div style={{ background: 'rgba(245,158,11,.08)', border: `1px solid rgba(245,158,11,.4)`, borderRadius: 12, padding: 14, marginBottom: 18, fontSize: 13, color: '#f5d9a8' }}>
              <b>⚠️ Bootstrap requis.</b> Le token Management Supabase n'est pas configuré, donc poser/supprimer une clé est désactivé
              (le bouton « Tester » fonctionne quand même). Pose-le une seule fois :<br />
              <code style={{ display: 'block', marginTop: 6, color: '#fff' }}>
                supabase secrets set SUPABASE_MGMT_TOKEN=&lt;ton_PAT&gt; --project-ref fwfupxvmwtxbtbjdeqvu
              </code>
            </div>
          ) : null}

          {state.loading ? (
            <div style={{ color: C.muted }}>Chargement…</div>
          ) : state.error ? (
            <div style={{ color: C.red }}>Erreur : {state.error}</div>
          ) : (
            <>
              {state.providers.map((p) => (
                <ProviderRow key={p.key} p={p} onSaved={load} />
              ))}

              <h2 style={{ fontSize: 15, fontWeight: 700, margin: '24px 0 10px' }}>Modèles (optionnel)</h2>
              <div style={{ background: C.panel, border: `1px solid ${C.border2}`, borderRadius: 12, padding: 16 }}>
                {state.models.map((m) => (
                  <ModelRow key={m.name} m={m} onSaved={load} />
                ))}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
