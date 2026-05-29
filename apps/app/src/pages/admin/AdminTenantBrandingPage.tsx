import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

/**
 * Page admin Cimolace — éditeur de branding tenant.
 *
 * Permet à un membre du staff Cimolace de :
 *  - Saisir / modifier le nom affiché du tenant
 *  - Saisir l'URL de son logo (pas d'upload : on s'attend à un URL public —
 *    Cloudinary, S3, etc.)
 *  - Picker la couleur primaire (color input HTML5)
 *  - Voir une preview live d'un faux écran patient-portal et d'un widget
 *    embed pour valider le rendu avant de sauvegarder
 *
 * Route attendue : /admin/tenants/:tenantId/branding
 *
 * Endpoint backend : PATCH /tenants/:tenantId/branding
 */
const API_BASE =
  (typeof window !== "undefined" &&
    (window as any).__API_BASE__) ||
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_URL) ||
  "https://api.cimolace.space";

const http = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

http.interceptors.request.use((cfg) => {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("supabase_token") : null;
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  const tenantSlug =
    typeof window !== "undefined" ? localStorage.getItem("tenant_slug") : null;
  if (tenantSlug) cfg.headers["X-Tenant-Slug"] = tenantSlug;
  return cfg;
});

type Tenant = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  brand_colors: Record<string, string>;
};

async function fetchTenant(tenantId: string): Promise<Tenant> {
  // Use /tenants/current — admin staff have access to any tenant when they
  // set the X-Tenant-Slug header. For now we trust the param.
  const res = await http.get(`/tenants/current`);
  return res.data.data as Tenant;
}

async function patchBranding(
  tenantId: string,
  body: Partial<Tenant>,
): Promise<Tenant> {
  const res = await http.patch(`/tenants/${tenantId}/branding`, body);
  return res.data.data as Tenant;
}

export function AdminTenantBrandingPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const queryClient = useQueryClient();

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["tenant", tenantId],
    queryFn: () => fetchTenant(tenantId!),
    enabled: !!tenantId,
  });

  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primary, setPrimary] = useState("#0d9488");
  const [accent, setAccent] = useState("#0f766e");
  const [initialised, setInitialised] = useState(false);

  // Initialise local state when tenant arrives, but only once so user edits
  // aren't overwritten by re-renders.
  if (tenant && !initialised) {
    setName(tenant.name);
    setLogoUrl(tenant.logo_url || "");
    setPrimary(tenant.brand_colors?.primary || "#0d9488");
    setAccent(
      tenant.brand_colors?.accent ||
        tenant.brand_colors?.secondary ||
        "#0f766e",
    );
    setInitialised(true);
  }

  const save = useMutation({
    mutationFn: () =>
      patchBranding(tenantId!, {
        name: name || undefined,
        logo_url: logoUrl || undefined,
        brand_colors: { primary, accent },
      } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant", tenantId] });
    },
  });

  if (!tenantId) {
    return (
      <div style={{ padding: 40, color: "#dc2626" }}>
        tenant_id manquant dans l'URL.
      </div>
    );
  }
  if (isLoading) {
    return <div style={{ padding: 40, color: "#64748b" }}>Chargement…</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: 32 }}>
      <header style={{ marginBottom: 24 }}>
        <p
          style={{
            fontSize: 11,
            color: "#94a3b8",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Cimolace admin
        </p>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          Branding — {tenant?.name}
        </h1>
        <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
          Couleurs et logo qui sont injectés dans le widget MEDOS, l'espace
          patient et le PDF ordonnance.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Form */}
        <section
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: 24,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, marginBottom: 16 }}>
            Identité visuelle
          </h2>

          <Field label="Nom affiché">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cabinet Zahir Wellness"
              style={inputStyle}
            />
          </Field>

          <Field label="URL du logo (PNG, SVG, JPG)">
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://cdn.zahirwellness.com/logo.png"
              style={inputStyle}
            />
            <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
              Idéalement carré, 200×200px min. Hébergé sur un CDN public.
            </p>
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Couleur primaire">
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="color"
                  value={primary}
                  onChange={(e) => setPrimary(e.target.value)}
                  style={{
                    width: 40,
                    height: 40,
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    padding: 0,
                    cursor: "pointer",
                  }}
                />
                <input
                  type="text"
                  value={primary}
                  onChange={(e) => setPrimary(e.target.value)}
                  style={{ ...inputStyle, fontFamily: "monospace" }}
                  placeholder="#0d9488"
                />
              </div>
            </Field>

            <Field label="Couleur accent (optionnel)">
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  style={{
                    width: 40,
                    height: 40,
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    padding: 0,
                    cursor: "pointer",
                  }}
                />
                <input
                  type="text"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  style={{ ...inputStyle, fontFamily: "monospace" }}
                  placeholder="#0f766e"
                />
              </div>
            </Field>
          </div>

          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            style={{
              marginTop: 20,
              padding: "10px 18px",
              background: primary,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: save.isPending ? "wait" : "pointer",
              width: "100%",
            }}
          >
            {save.isPending ? "Sauvegarde…" : "Sauvegarder"}
          </button>

          {save.isError && (
            <div
              style={{
                marginTop: 12,
                padding: 10,
                background: "#fef2f2",
                color: "#991b1b",
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              {(save.error as any)?.response?.data?.error?.message ||
                (save.error as any)?.message ||
                "Echec de la sauvegarde"}
            </div>
          )}
          {save.isSuccess && !save.isPending && (
            <div
              style={{
                marginTop: 12,
                padding: 10,
                background: "#d1fae5",
                color: "#065f46",
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              ✓ Branding mis à jour. Les utilisateurs verront le nouveau
              rendu au prochain rafraîchissement de leur app.
            </div>
          )}
        </section>

        {/* Preview */}
        <section>
          <h2
            style={{
              fontSize: 14,
              fontWeight: 600,
              margin: 0,
              marginBottom: 12,
              color: "#475569",
            }}
          >
            Aperçu live
          </h2>

          {/* Patient portal preview */}
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              overflow: "hidden",
              marginBottom: 12,
              background: "#fff",
            }}
          >
            <div
              style={{
                background: primary,
                color: "#fff",
                padding: 16,
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={name}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    objectFit: "contain",
                    background: "#fff",
                    padding: 2,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    background: "rgba(255,255,255,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                  }}
                >
                  {(name || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>
                  Mon espace
                </div>
                <div style={{ fontSize: 11, opacity: 0.9 }}>{name}</div>
              </div>
            </div>
            <div style={{ padding: 20, fontSize: 13, color: "#475569" }}>
              <p style={{ margin: 0, marginBottom: 8 }}>
                Sidebar du portail patient avec votre marque
              </p>
              <button
                style={{
                  background: primary,
                  color: "#fff",
                  border: "none",
                  padding: "8px 14px",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Bouton d'action
              </button>
            </div>
          </div>

          {/* Widget embed preview */}
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: 20,
              background: "#fff",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                paddingBottom: 12,
                borderBottom: "1px solid #f3f4f6",
                marginBottom: 16,
              }}
            >
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt={name}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    objectFit: "contain",
                  }}
                />
              )}
              <span style={{ fontSize: 14, fontWeight: 600, color: primary }}>
                {name}
              </span>
            </div>
            <h3 style={{ margin: 0, marginBottom: 4, fontSize: 18 }}>
              Mon dossier médical
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
              Aperçu du widget MEDOS embarqué sur le site du tenant.
            </p>
            <p
              style={{
                margin: 0,
                marginTop: 16,
                fontSize: 11,
                color: "#9ca3af",
              }}
            >
              Sécurisé · Conforme RGPD
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #e2e8f0",
  borderRadius: 6,
  fontSize: 14,
  boxSizing: "border-box",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span
        style={{
          display: "block",
          fontSize: 12,
          color: "#475569",
          marginBottom: 6,
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

export default AdminTenantBrandingPage;
