import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import {
  cimolaceAdminApi,
  type GeneratedApiKey,
  type TenantApiKey,
  type TenantDomain,
} from "../../lib/api";

/**
 * Page admin Cimolace — gestion de l'intégration MEDOS d'un tenant.
 *
 * Permet à un membre du staff Cimolace de :
 *  - Générer / lister / révoquer des clés API tenant (server-to-server)
 *  - Whitelister les domaines autorisés à charger le widget MEDOS et obtenir
 *    des embed-tokens (cas Mode C : site externe comme ZahirWellness)
 *
 * Route attendue : /admin/tenants/:tenantId/embed
 */
export function AdminTenantEmbedPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  if (!tenantId) {
    return (
      <Layout title="Configuration introuvable">
        <p className="text-red-600 text-sm">
          tenant_id manquant dans l'URL.
        </p>
      </Layout>
    );
  }

  return (
    <Layout title={`Intégration MEDOS — ${tenantId}`}>
      <div className="space-y-12">
        <ApiKeysSection tenantId={tenantId} />
        <DomainsSection tenantId={tenantId} />
        <IntegrationSnippetSection tenantId={tenantId} />
      </div>
    </Layout>
  );
}

// ───────────────────────────────────────────────────────────────────────────

function Layout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <p className="text-xs uppercase tracking-wide text-gray-400">
          Cimolace Admin
        </p>
        <h1 className="font-semibold text-gray-900">{title}</h1>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Section 1 — Clés API tenant
// ───────────────────────────────────────────────────────────────────────────

function ApiKeysSection({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const [label, setLabel] = useState("");
  const [revealedKey, setRevealedKey] = useState<GeneratedApiKey | null>(null);

  const keys = useQuery({
    queryKey: ["admin-api-keys", tenantId],
    queryFn: () => cimolaceAdminApi.listApiKeys(tenantId),
  });

  const createMut = useMutation({
    mutationFn: (input: { label: string }) =>
      cimolaceAdminApi.createApiKey(tenantId, input),
    onSuccess: (data) => {
      setRevealedKey(data);
      setLabel("");
      qc.invalidateQueries({ queryKey: ["admin-api-keys", tenantId] });
    },
  });

  const revokeMut = useMutation({
    mutationFn: (keyId: string) =>
      cimolaceAdminApi.revokeApiKey(tenantId, keyId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin-api-keys", tenantId] }),
  });

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Clés API tenant</h2>
          <p className="text-sm text-gray-600">
            Utilisées par le backend d'un site externe pour appeler MEDOS
            (server-to-server). Préfixe <code>mdk_*</code>.
          </p>
        </div>
      </div>

      <form
        className="bg-white rounded-lg border border-gray-200 p-4 flex gap-3 items-end mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (label.trim().length < 3) return;
          createMut.mutate({ label: label.trim() });
        }}
      >
        <label className="flex-1">
          <span className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
            Label (utilité de la clé)
          </span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex : Zahir Wellness — backend prod"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={createMut.isPending || label.trim().length < 3}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {createMut.isPending ? "Génération..." : "Générer une clé"}
        </button>
      </form>

      {revealedKey && <RevealedKeyBanner k={revealedKey} onClose={() => setRevealedKey(null)} />}

      {createMut.isError && (
        <p className="text-red-600 text-sm mb-3">
          {(createMut.error as Error).message}
        </p>
      )}

      {keys.isLoading && <p className="text-gray-500 text-sm">Chargement...</p>}
      {keys.isError && (
        <p className="text-red-600 text-sm">{(keys.error as Error).message}</p>
      )}

      {keys.data && keys.data.length === 0 && (
        <p className="text-sm text-gray-500">Aucune clé pour ce tenant.</p>
      )}

      <ul className="divide-y divide-gray-200 bg-white rounded-lg border border-gray-200">
        {(keys.data ?? []).map((k) => (
          <ApiKeyRow
            key={k.id}
            apiKey={k}
            onRevoke={() => revokeMut.mutate(k.id)}
            isRevoking={revokeMut.isPending && revokeMut.variables === k.id}
          />
        ))}
      </ul>
    </section>
  );
}

function RevealedKeyBanner({
  k,
  onClose,
}: {
  k: GeneratedApiKey;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-bold text-amber-950">
          Copier maintenant — cette clé ne sera plus jamais affichée
        </p>
        <button
          onClick={onClose}
          className="text-amber-800 hover:text-amber-950 text-xl leading-none"
          aria-label="Fermer"
        >
          ×
        </button>
      </div>
      <div className="flex gap-2 items-center">
        <code className="flex-1 bg-white border border-amber-300 rounded px-3 py-2 text-xs font-mono break-all">
          {k.raw_key}
        </code>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(k.raw_key);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="rounded-md bg-amber-600 px-3 py-2 text-xs font-medium text-white hover:bg-amber-700"
        >
          {copied ? "Copié !" : "Copier"}
        </button>
      </div>
      <p className="text-xs text-amber-800 mt-2">
        Label : <strong>{k.label}</strong> · Préfixe affiché ensuite :{" "}
        <code>{k.key_prefix}</code>
      </p>
    </div>
  );
}

function ApiKeyRow({
  apiKey,
  onRevoke,
  isRevoking,
}: {
  apiKey: TenantApiKey;
  onRevoke: () => void;
  isRevoking: boolean;
}) {
  const isRevoked = !!apiKey.revoked_at;

  return (
    <li className="px-4 py-3 flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 truncate">
            {apiKey.label}
          </span>
          {isRevoked && (
            <span className="rounded-full bg-red-100 text-red-800 text-xs px-2 py-0.5">
              révoquée
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5 font-mono">
          {apiKey.key_prefix}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          Créée le {fmt(apiKey.created_at)}
          {apiKey.last_used_at && ` · Dernier usage ${fmt(apiKey.last_used_at)}`}
        </p>
      </div>
      {!isRevoked && (
        <button
          onClick={() => {
            if (
              window.confirm(
                "Révoquer cette clé ? Les appels en cours échoueront.",
              )
            ) {
              onRevoke();
            }
          }}
          disabled={isRevoking}
          className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          {isRevoking ? "..." : "Révoquer"}
        </button>
      )}
    </li>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Section 2 — Domaines whitelistés
// ───────────────────────────────────────────────────────────────────────────

function DomainsSection({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const [domain, setDomain] = useState("");

  const domains = useQuery({
    queryKey: ["admin-domains", tenantId],
    queryFn: () => cimolaceAdminApi.listDomains(tenantId),
  });

  const addMut = useMutation({
    mutationFn: (input: { domain: string }) =>
      cimolaceAdminApi.addDomain(tenantId, {
        domain: input.domain,
        usage: "embed_origin",
      }),
    onSuccess: () => {
      setDomain("");
      qc.invalidateQueries({ queryKey: ["admin-domains", tenantId] });
    },
  });

  const revokeMut = useMutation({
    mutationFn: (domainId: string) =>
      cimolaceAdminApi.revokeDomain(tenantId, domainId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin-domains", tenantId] }),
  });

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900">
          Domaines autorisés (embed)
        </h2>
        <p className="text-sm text-gray-600">
          Origins HTTP qui peuvent charger le widget MEDOS et obtenir un
          embed-token. Format : <code>zahirwellness.com</code> (sans
          protocole).
        </p>
      </div>

      <form
        className="bg-white rounded-lg border border-gray-200 p-4 flex gap-3 items-end mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (domain.trim().length < 3) return;
          addMut.mutate({ domain: domain.trim() });
        }}
      >
        <label className="flex-1">
          <span className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
            Domaine
          </span>
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="zahirwellness.com"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
          />
        </label>
        <button
          type="submit"
          disabled={addMut.isPending}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {addMut.isPending ? "Ajout..." : "Whitelist"}
        </button>
      </form>

      {addMut.isError && (
        <p className="text-red-600 text-sm mb-3">
          {(addMut.error as Error).message}
        </p>
      )}

      <ul className="divide-y divide-gray-200 bg-white rounded-lg border border-gray-200">
        {(domains.data ?? []).map((d) => (
          <DomainRow
            key={d.id}
            d={d}
            onRevoke={() => revokeMut.mutate(d.id)}
            isRevoking={revokeMut.isPending && revokeMut.variables === d.id}
          />
        ))}
        {domains.data && domains.data.length === 0 && (
          <li className="px-4 py-3 text-sm text-gray-500">
            Aucun domaine whitelisté.
          </li>
        )}
      </ul>
    </section>
  );
}

function DomainRow({
  d,
  onRevoke,
  isRevoking,
}: {
  d: TenantDomain;
  onRevoke: () => void;
  isRevoking: boolean;
}) {
  const isRevoked = d.status === "revoked";
  const usageLabel =
    d.usage === "embed_origin" ? "Embed widget" : "Domaine hébergé (Mode B)";

  return (
    <li className="px-4 py-3 flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <code className="font-mono text-sm text-gray-900">{d.domain}</code>
          <span className="rounded-full bg-gray-100 text-gray-700 text-xs px-2 py-0.5">
            {usageLabel}
          </span>
          {isRevoked && (
            <span className="rounded-full bg-red-100 text-red-800 text-xs px-2 py-0.5">
              révoqué
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Ajouté le {fmt(d.created_at)}
        </p>
      </div>
      {!isRevoked && (
        <button
          onClick={() => {
            if (window.confirm(`Révoquer ${d.domain} ?`)) onRevoke();
          }}
          disabled={isRevoking}
          className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          {isRevoking ? "..." : "Révoquer"}
        </button>
      )}
    </li>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Section 3 — Snippet à donner au client
// ───────────────────────────────────────────────────────────────────────────

function IntegrationSnippetSection({ tenantId }: { tenantId: string }) {
  const tenant = useQuery({
    queryKey: ["admin-tenant-slug", tenantId],
    // En MVP on hardcode le slug = tenantId. Une fois l'endpoint admin
    // GET /admin/tenants/:id ajouté, on récupère le vrai slug.
    queryFn: () => Promise.resolve({ slug: tenantId }),
  });

  const slug = tenant.data?.slug ?? tenantId;
  const snippet = `<div id="medos-portal"></div>
<script
  src="https://cdn.cimolace.com/medos/v1/embed.js"
  data-tenant="${slug}"
  data-mode="patient-portal"
  async
></script>`;

  return (
    <section>
      <h2 className="text-lg font-bold text-gray-900 mb-2">
        Snippet à intégrer sur le site client
      </h2>
      <p className="text-sm text-gray-600 mb-3">
        À coller sur la page où afficher le portail patient MEDOS. Modes
        disponibles : <code>patient-portal</code>, <code>appointment-booker</code>,{" "}
        <code>consent-form</code>, <code>intake-form</code>,{" "}
        <code>health-tracker</code>.
      </p>
      <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto">
        <code>{snippet}</code>
      </pre>
      <p className="text-xs text-gray-500 mt-2">
        Préalable : le domaine du site client doit être whitelisté ci-dessus.
      </p>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────────

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default AdminTenantEmbedPage;
