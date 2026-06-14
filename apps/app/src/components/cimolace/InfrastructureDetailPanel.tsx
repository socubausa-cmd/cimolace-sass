import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { tenantApiKeysApi, billingApi } from '@/lib/api';

/**
 * Panneau détail d'une infrastructure (tenant courant) :
 *  - Clés API : lister, générer (clé brute affichée UNE fois), révoquer
 *  - Snippet d'installation (SDK Liri) pour brancher l'infra sur un site existant
 *  - Abonnement : statut + paiement par carte (Stripe checkout)
 * 100 % front : consomme /tenants/api-keys et /billing/* existants.
 */
export function InfrastructureDetailPanel({
  tenantSlug,
  publicHost = 'https://cimolace.space',
}: {
  tenantSlug?: string | null;
  publicHost?: string;
}) {
  const qc = useQueryClient();
  const keys = useQuery({ queryKey: ['api-keys'], queryFn: tenantApiKeysApi.list });
  const plan = useQuery({ queryKey: ['billing-plan'], queryFn: billingApi.getPlan });

  const [label, setLabel] = useState('');
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createKey = useMutation({
    mutationFn: (l: string) => tenantApiKeysApi.create(l),
    onSuccess: (res: any) => {
      if (res?.key) setFreshKey(res.key);
      setLabel('');
      void qc.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });
  const revokeKey = useMutation({
    mutationFn: (id: string) => tenantApiKeysApi.revoke(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['api-keys'] }),
  });

  const keyList: any[] = Array.isArray(keys.data) ? keys.data : [];
  const subs: any[] = Array.isArray(plan.data?.subscriptions) ? (plan.data as any).subscriptions : [];
  const slug = tenantSlug || 'mon-infra';

  const snippet = `<script
  src="${publicHost}/liri-sdk.js"
  data-tenant="${slug}"
  data-key="mdk_VOTRE_CLE_API">
</script>`;

  const copy = (text: string) => {
    try {
      void navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard indisponible */
    }
  };

  return (
    <div className="mt-6 space-y-6">
      {/* ── Clés API ───────────────────────────────────────────── */}
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-gray-900">Clés API</h3>
        <p className="mt-1 text-sm text-gray-500">
          Sers-toi d'une clé pour brancher cette infrastructure sur un site externe (modèle Stripe/Zoom).
        </p>

        {freshKey && (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs font-medium text-emerald-800">
              Clé créée — copie-la maintenant, elle ne sera plus affichée :
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-white px-2 py-1 text-xs text-gray-800">{freshKey}</code>
              <button
                type="button"
                onClick={() => copy(freshKey)}
                className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
              >
                {copied ? 'Copié' : 'Copier'}
              </button>
            </div>
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nom de la clé (ex: site vitrine)"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={!label.trim() || createKey.isPending}
            onClick={() => createKey.mutate(label.trim())}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {createKey.isPending ? 'Génération…' : 'Générer une clé'}
          </button>
        </div>

        <div className="mt-4 divide-y divide-gray-100">
          {keys.isLoading && <p className="py-2 text-sm text-gray-500">Chargement…</p>}
          {!keys.isLoading && keyList.length === 0 && (
            <p className="py-2 text-sm text-gray-400">Aucune clé pour l'instant.</p>
          )}
          {keyList.map((k) => (
            <div key={k.id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-800">{k.label || 'Sans nom'}</p>
                <p className="text-xs text-gray-400">
                  {k.key_prefix}…{' '}
                  {k.last_used_at ? `· utilisée le ${new Date(k.last_used_at).toLocaleDateString()}` : '· jamais utilisée'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => revokeKey.mutate(k.id)}
                disabled={revokeKey.isPending}
                className="text-xs text-red-600 hover:underline disabled:opacity-50"
              >
                Révoquer
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── Installation ──────────────────────────────────────── */}
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-gray-900">Installation sur ton site</h3>
        <p className="mt-1 text-sm text-gray-500">
          Colle ce snippet dans ton site existant pour y intégrer les moteurs de cette infrastructure.
        </p>
        <div className="mt-3 flex items-start gap-2">
          <pre className="flex-1 overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs leading-relaxed text-gray-100">
            {snippet}
          </pre>
          <button
            type="button"
            onClick={() => copy(snippet)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            {copied ? 'Copié' : 'Copier'}
          </button>
        </div>
      </section>

      {/* ── Abonnement ────────────────────────────────────────── */}
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-gray-900">Abonnement</h3>
        {plan.isLoading && <p className="mt-1 text-sm text-gray-500">Chargement…</p>}
        {!plan.isLoading && subs.length === 0 && (
          <p className="mt-1 text-sm text-gray-400">
            Aucun abonnement actif. Active un plan pour mettre cette infrastructure en production.
          </p>
        )}
        {subs.map((s) => (
          <div key={s.id} className="mt-3 flex items-center justify-between rounded-lg border border-gray-100 p-3">
            <div>
              <p className="text-sm font-medium text-gray-800">
                {s.plan_id} ·{' '}
                <span
                  className={
                    s.status === 'active'
                      ? 'text-emerald-600'
                      : s.status === 'past_due' || s.status === 'unpaid'
                        ? 'text-red-600'
                        : 'text-amber-600'
                  }
                >
                  {s.status}
                </span>
              </p>
              <p className="text-xs text-gray-400">
                {(s.amount_cents / 100).toFixed(2)} {s.currency?.toUpperCase()}
                {s.current_period_end ? ` · jusqu'au ${new Date(s.current_period_end).toLocaleDateString()}` : ''}
              </p>
            </div>
            {s.status !== 'active' && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res: any = await billingApi.cardCheckout(s.id);
                    if (res?.url) window.location.href = res.url;
                  } catch {
                    /* ignore */
                  }
                }}
                className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-800"
              >
                Payer par carte
              </button>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

export default InfrastructureDetailPanel;
