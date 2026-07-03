/**
 * LiriDomainSettings — onglet « Domaine personnalisé » du compte tenant LIRI.
 *
 * Self-service façon Vercel/Stripe : l'owner colle son domaine (mon-ecole.com) →
 * l'app le déclare (tenant_domains custom_host, status=pending) + tente
 * l'attachement Vercel → affiche les 2 enregistrements DNS à poser chez le
 * registrar → bouton « Vérifier » (check DNS RÉEL côté API) → status=active +
 * ligne CORS embed_origin. Dès lors, les élèves qui tapent le domaine atterrissent
 * sur la vitrine brandée de l'org (résolution host→tenant, cf. tenantResolver).
 *
 * IN-REALM LIRI (aucun saut /cimolace ni /t/:slug) — rendu dans le hub compte
 * (LiriAccountPage, section 'domaine'). Style chaud du portail (classes lp-*).
 * API : tenantPortalApi.domains/addDomain/verifyDomain/deleteDomain (owner/admin).
 */
import { useEffect, useState } from 'react';
import { Globe, Loader2, Check, Copy, Trash2, RefreshCw, AlertCircle, ExternalLink } from 'lucide-react';
import { tenantPortalApi } from '@/lib/api';

const STATUS_BADGE = {
  active: { label: 'Actif', cls: 'border-green-500/30 bg-green-500/15 text-green-400' },
  pending: { label: 'En attente du DNS', cls: 'border-[#e6b878]/40 bg-[#e6b878]/10 text-[#e6b878]' },
  revoked: { label: 'Révoqué', cls: 'border-red-500/30 bg-red-500/10 text-red-300' },
};

function DnsRow({ type, name, value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try { navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* noop */ }
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[rgba(245,244,238,0.08)] bg-black/20 px-3 py-2 font-mono text-[12px]">
      <span className="w-14 shrink-0 font-bold text-[#e58a5f]">{type}</span>
      <span className="lp-muted min-w-[70px]">{name}</span>
      <span className="lp-ink flex-1 truncate">{value}</span>
      <button type="button" onClick={copy} className="lp-muted rounded p-1 transition-colors hover:text-white" aria-label={`Copier ${value}`}>
        {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

export default function LiriDomainSettings() {
  const [state, setState] = useState({ loading: true, domains: [], dns: null });
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(null); // 'add' | `verify-${id}` | `del-${id}`
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [dnsFeedback, setDnsFeedback] = useState({}); // id -> dnsObserved

  const load = () =>
    tenantPortalApi.domains()
      .then((d) => setState({ loading: false, domains: d?.domains ?? [], dns: d?.dns ?? null }))
      .catch((e) => { setState((s) => ({ ...s, loading: false })); setError(e?.message || 'Chargement impossible.'); });

  useEffect(() => { load(); }, []);

  const add = async () => {
    const domain = input.trim();
    if (!domain) return;
    setBusy('add'); setError(null); setNotice(null);
    try {
      await tenantPortalApi.addDomain(domain);
      setInput('');
      setNotice('Domaine déclaré — posez les 2 enregistrements DNS ci-dessous chez votre registrar, puis « Vérifier ».');
      await load();
    } catch (e) { setError(e?.message || 'Déclaration impossible.'); }
    finally { setBusy(null); }
  };

  const verify = async (row) => {
    setBusy(`verify-${row.id}`); setError(null); setNotice(null);
    try {
      const r = await tenantPortalApi.verifyDomain(row.id);
      if (r?.verified) {
        setNotice(`✅ ${row.domain} est vérifié et actif — vos élèves peuvent y accéder (SSL en cours d'émission si premier passage).`);
        setDnsFeedback((f) => ({ ...f, [row.id]: null }));
      } else {
        setDnsFeedback((f) => ({ ...f, [row.id]: r?.dnsObserved || 'DNS pas encore propagé.' }));
      }
      await load();
    } catch (e) { setError(e?.message || 'Vérification impossible.'); }
    finally { setBusy(null); }
  };

  const remove = async (row) => {
    setBusy(`del-${row.id}`); setError(null);
    try { await tenantPortalApi.deleteDomain(row.id); await load(); }
    catch (e) { setError(e?.message || 'Suppression impossible.'); }
    finally { setBusy(null); }
  };

  const dns = state.dns || { apexA: '76.76.21.21', cname: 'cname.vercel-dns.com' };

  return (
    <div className="space-y-5">
      <p className="lp-muted text-sm leading-relaxed">
        Reliez votre propre domaine (ex. <span className="lp-ink font-semibold">mon-ecole.com</span>) : vos élèves
        arrivent directement sur votre espace, à vos couleurs — sans jamais voir la plateforme.
      </p>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/[0.08] px-4 py-3 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-2 rounded-xl border border-green-500/25 bg-green-500/[0.08] px-4 py-3 text-sm text-green-200">
          <Check className="mt-0.5 h-4 w-4 shrink-0" /> {notice}
        </div>
      )}

      {/* Déclarer un domaine */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-[rgba(245,244,238,0.12)] bg-black/20 px-3 py-2.5">
          <Globe className="h-4 w-4 shrink-0 text-[#e58a5f]" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
            placeholder="mon-ecole.com"
            className="lp-ink w-full bg-transparent text-sm outline-none placeholder:text-[rgba(245,244,238,0.3)]"
          />
        </div>
        <button
          type="button"
          onClick={add}
          disabled={busy === 'add' || !input.trim()}
          className="flex items-center gap-2 rounded-xl bg-[#d97757] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#c9673f] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === 'add' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />} Connecter mon domaine
        </button>
      </div>

      {/* Liste des domaines */}
      {state.loading ? (
        <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#d97757]" /></div>
      ) : state.domains.length === 0 ? (
        <p className="lp-faint text-sm">Aucun domaine relié pour le moment.</p>
      ) : (
        <div className="space-y-4">
          {state.domains.map((row) => {
            const badge = STATUS_BADGE[row.status] || STATUS_BADGE.pending;
            const feedback = dnsFeedback[row.id];
            return (
              <div key={row.id} className="rounded-2xl border border-[rgba(245,244,238,0.10)] bg-[rgba(0,0,0,0.16)] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="lp-ink flex-1 truncate font-mono text-sm font-semibold">{row.domain}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}>{badge.label}</span>
                  {row.status === 'active' && (
                    <a href={`https://${row.domain}`} target="_blank" rel="noreferrer" className="lp-muted p-1 transition-colors hover:text-white" aria-label={`Ouvrir ${row.domain}`}>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(row)}
                    disabled={busy === `del-${row.id}`}
                    className="p-1 text-red-300/60 transition-colors hover:text-red-300 disabled:opacity-40"
                    aria-label={`Retirer ${row.domain}`}
                  >
                    {busy === `del-${row.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>

                {row.status !== 'active' && (
                  <div className="mt-3 space-y-2">
                    <p className="lp-muted text-xs">Chez votre registrar (OVH, Namecheap, GoDaddy…), posez ces 2 enregistrements :</p>
                    <DnsRow type="A" name="@ (apex)" value={dns.apexA} />
                    <DnsRow type="CNAME" name="www" value={dns.cname} />
                    {feedback && (
                      <p className="flex items-start gap-1.5 text-xs text-[#e6b878]">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> DNS observé : {feedback}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => verify(row)}
                      disabled={busy === `verify-${row.id}`}
                      className="flex items-center gap-2 rounded-lg border border-[#d97757]/40 bg-[#d97757]/10 px-3 py-2 text-[13px] font-semibold text-[#e58a5f] transition-colors hover:bg-[#d97757]/20 disabled:opacity-40"
                    >
                      {busy === `verify-${row.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Vérifier la configuration
                    </button>
                  </div>
                )}
                {row.status === 'active' && row.verified_at && (
                  <p className="lp-faint mt-2 text-xs">Vérifié le {new Date(row.verified_at).toLocaleDateString('fr-FR')} · SSL automatique.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
