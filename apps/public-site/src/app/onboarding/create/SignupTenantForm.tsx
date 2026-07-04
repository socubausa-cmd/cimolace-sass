"use client";

import { useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://api.cimolace.space";
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://app.cimolace.space";

interface SignupResult {
  tenant: { slug: string; name: string };
  next_url: string;
}

interface GeneratedBrand {
  name: string;
  primary: string;
  accent: string;
  site: {
    heroTitle: string;
    heroAccent: string;
    heroSubtitle: string;
    ctaPrimary: string;
    services: { title: string; desc: string }[];
  };
}

export function SignupTenantForm({
  kind,
  color,
  nextTab,
}: {
  kind: string;
  color: string;
  nextTab: string;
}) {
  const [form, setForm] = useState({
    email: "",
    password: "",
    platformName: "",
    slug: "",
  });
  const [description, setDescription] = useState("");
  const [generating, setGenerating] = useState(false);
  const [brand, setBrand] = useState<GeneratedBrand | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
    if (error) setError(null);
  }

  const autoSlug = form.platformName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  const effectiveSlug = form.slug || autoSlug;

  async function handleGenerate() {
    if (description.trim().length < 8) {
      setError("Décris ton activité en quelques mots (8 caractères min).");
      return;
    }
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch(`${API_URL}/signup/ai-brand`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error?.message ?? "Génération IA indisponible, réessaie.");
      }
      const body = await res.json();
      const data = (body.data ?? body) as GeneratedBrand;
      setBrand(data);
      // Pré-remplit le nom si vide (l'utilisateur garde la main)
      setForm((f) => (f.platformName ? f : { ...f, platformName: data.name }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/signup/tenant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          platformName: form.platformName,
          slug: effectiveSlug || undefined,
          kind,
          brand: brand
            ? { primary: brand.primary, accent: brand.accent, site: brand.site }
            : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg =
          body?.error?.message ??
          body?.message ??
          `Erreur ${res.status} lors de la création`;
        throw new Error(Array.isArray(msg) ? msg.join(", ") : String(msg));
      }
      const body = await res.json();
      const data = (body.data ?? body) as SignupResult;
      // Redirection COHÉRENTE avec le flux de l'app (liri.cimolace.space/creer-organisation) :
      // on relaie le next_url du backend (/liri pour LIRI, /t/{slug}/admin/… sinon) via le
      // login tenant, qui l'honore désormais → les DEUX portails de création atterrissent au
      // MÊME endroit (le realm produit), au lieu d'un /t/{slug}/login générique divergent.
      const next = data.next_url || `/t/${data.tenant.slug}/admin`;
      const url = `${APP_URL}/t/${data.tenant.slug}/login?welcome=1&next=${encodeURIComponent(next)}`;
      window.location.href = url;
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 14px",
    borderRadius: "10px",
    border: "1px solid #21262d",
    background: "#0d1117",
    color: "#f0f6fc",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    color: "#8b949e",
    fontSize: "11px",
    fontWeight: 600,
    display: "block",
    marginBottom: "6px",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: "#161b22",
        border: `1px solid ${color}33`,
        borderTop: `3px solid ${color}`,
        borderRadius: "14px",
        padding: "28px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        boxShadow: `0 0 32px ${color}1a`,
      }}
    >
      {error && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "8px",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#fca5a5",
            fontSize: "13px",
          }}
        >
          {error}
        </div>
      )}

      {/* ── AI Brand-in-a-box ─────────────────────────────────────── */}
      <div
        style={{
          background: "#0d1117",
          border: `1px solid ${color}33`,
          borderRadius: "12px",
          padding: "18px",
        }}
      >
        <label style={labelStyle}>✨ Décrivez votre activité</label>
        <textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Ex : cabinet de kinésithérapie du sport à Dakar, récupération et performance"
          rows={2}
          style={{ ...inputStyle, resize: "vertical", minHeight: "58px" }}
        />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          style={{
            marginTop: "10px",
            padding: "10px 16px",
            borderRadius: "9px",
            border: `1px solid ${color}`,
            background: generating ? "#21262d" : `${color}1f`,
            color: generating ? "#8b949e" : color,
            fontSize: "13px",
            fontWeight: 700,
            cursor: generating ? "wait" : "pointer",
            width: "100%",
          }}
        >
          {generating
            ? "L'IA crée votre marque…"
            : brand
              ? "↻ Régénérer ma marque"
              : "✨ Générer ma marque avec l'IA"}
        </button>

        {brand && (
          <div
            style={{
              marginTop: "14px",
              paddingTop: "14px",
              borderTop: "1px solid #21262d",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <div style={{ display: "flex", gap: "5px" }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, background: brand.primary, border: "1px solid #30363d" }} />
                <span style={{ width: 22, height: 22, borderRadius: 6, background: brand.accent, border: "1px solid #30363d" }} />
              </div>
              <span style={{ color: "#f0f6fc", fontWeight: 700, fontSize: "14px" }}>{brand.name}</span>
            </div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "#f0f6fc", lineHeight: 1.25 }}>
              {brand.site.heroTitle}{" "}
              <span style={{ color: brand.primary }}>{brand.site.heroAccent}</span>
            </div>
            <div style={{ fontSize: "12px", color: "#8b949e", marginTop: "6px" }}>
              {brand.site.heroSubtitle}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
              {brand.site.services.map((s) => (
                <span
                  key={s.title}
                  style={{
                    fontSize: "11px",
                    color: brand.primary,
                    background: `${brand.primary}1a`,
                    border: `1px solid ${brand.primary}40`,
                    borderRadius: "999px",
                    padding: "3px 10px",
                  }}
                >
                  {s.title}
                </span>
              ))}
            </div>
            <div style={{ marginTop: "10px", fontSize: "11px", color: "#3fb950" }}>
              ✓ Cette identité habillera votre espace dès sa création.
            </div>
          </div>
        )}
      </div>

      <div>
        <label style={labelStyle}>Nom de votre plateforme</label>
        <input
          type="text"
          required
          minLength={2}
          maxLength={80}
          value={form.platformName}
          onChange={(e) => update("platformName", e.target.value)}
          placeholder="Ex : Académie Pierre Dubois"
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>
          Slug (URL) <span style={{ color: "#6e7681", textTransform: "none" }}>— optionnel</span>
        </label>
        <div style={{ position: "relative" }}>
          <input
            type="text"
            value={form.slug}
            onChange={(e) =>
              update("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
            }
            placeholder={autoSlug || "mon-academie"}
            style={{ ...inputStyle, paddingLeft: "180px" }}
            maxLength={40}
          />
          <span
            style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "#6e7681",
              fontSize: "13px",
              fontFamily: "ui-monospace, Menlo, monospace",
              pointerEvents: "none",
            }}
          >
            cimolace.space/t/
          </span>
        </div>
        <div style={{ marginTop: "4px", fontSize: "11px", color: "#6e7681" }}>
          {effectiveSlug ? (
            <>
              URL finale : <code style={{ color: color }}>cimolace.space/t/{effectiveSlug}</code>
            </>
          ) : (
            "Auto-généré depuis le nom"
          )}
        </div>
      </div>

      <div>
        <label style={labelStyle}>Votre email</label>
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          placeholder="vous@votreentreprise.com"
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Mot de passe</label>
        <input
          type="password"
          required
          minLength={8}
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
          placeholder="••••••••"
          style={inputStyle}
        />
        <div style={{ marginTop: "4px", fontSize: "11px", color: "#6e7681" }}>
          8 caractères minimum.
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        style={{
          marginTop: "8px",
          padding: "13px 18px",
          borderRadius: "10px",
          border: "none",
          background: loading ? "#21262d" : color,
          color: "white",
          fontSize: "14px",
          fontWeight: 700,
          cursor: loading ? "wait" : "pointer",
          transition: "all 0.18s ease",
          boxShadow: loading ? "none" : `0 4px 18px ${color}55`,
        }}
      >
        {loading ? "Création en cours…" : `Créer ma plateforme ${kind === "liri" ? "LIRI" : ""} →`}
      </button>

      <div style={{ textAlign: "center", marginTop: "4px", fontSize: "11px", color: "#6e7681" }}>
        En créant un compte, vous acceptez les{" "}
        <a
          href="/mentions-legales"
          style={{ color: color, textDecoration: "underline" }}
        >
          conditions
        </a>{" "}
        et{" "}
        <a href="/rgpd" style={{ color: color, textDecoration: "underline" }}>
          la politique de confidentialité
        </a>
        .
      </div>
    </form>
  );
}
