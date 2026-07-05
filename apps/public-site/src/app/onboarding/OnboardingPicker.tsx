"use client";

import { GraduationCap, Stethoscope, ShoppingBag, Users2, Sparkles, ArrowRight, type LucideIcon } from "lucide-react";

/**
 * Cliquer une carte d'infra → ouvre le formulaire self-serve sur Cimolace,
 * pas le backoffice opérateur. Le formulaire appelle l'API et redirige
 * ensuite vers app.cimolace.space/t/{slug}/login.
 */

type Infra = {
  key: string;
  icon: LucideIcon;
  label: string;
  desc: string;
  to: string | null;
  color: string;
  available: boolean;
  featured?: boolean;
};

const INFRA: Infra[] = [
  {
    key: "liri",
    icon: Sparkles,
    label: "LIRI Studio",
    desc: "Live + IA · Studio · Masterclass · SmartBoard",
    to: "/onboarding/create?kind=liri",
    color: "#d8b468",
    available: true,
    featured: true,
  },
  {
    key: "school",
    icon: GraduationCap,
    label: "École en ligne",
    desc: "11 moteurs · Live, cours, IA",
    to: "/onboarding/create?kind=school",
    color: "#d8b468",
    available: true,
  },
  {
    key: "medos",
    icon: Stethoscope,
    label: "MedOS",
    desc: "EHR · praticiens · patients",
    to: "/onboarding/create?kind=medos",
    color: "#d8b468",
    available: true,
  },
  {
    key: "mbolo",
    icon: ShoppingBag,
    label: "Virtuel Mbolo",
    desc: "Commerce · catalogue",
    to: null,
    color: "#d8b468",
    available: false,
  },
  {
    key: "community",
    icon: Users2,
    label: "Community Hub",
    desc: "Forum · messagerie",
    to: null,
    color: "#d8b468",
    available: false,
  },
];

export function OnboardingPicker() {
  return (
    <div className="grid gap-4 w-full max-w-[900px]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
      {INFRA.map((card) => (
        <InfraCard key={card.key} card={card} />
      ))}
    </div>
  );
}

function InfraCard({ card }: { card: Infra }) {
  const { icon: Icon, label, desc, to, color, available, featured } = card;

  const handleClick = () => {
    if (available && to) {
      window.location.href = to;
    }
  };

  const baseBg = featured
    ? `linear-gradient(180deg, ${color}10 0%, #161b22 60%)`
    : "#161b22";
  const hoverBg = featured
    ? `linear-gradient(180deg, ${color}1c 0%, #1c2128 60%)`
    : "#1c2128";

  return (
    <div
      onClick={handleClick}
      style={{
        position: "relative",
        padding: "24px",
        background: baseBg,
        border: `1px solid ${available ? (featured ? color + "66" : color + "33") : "#21262d"}`,
        borderTop: `3px solid ${available ? color : "#21262d"}`,
        borderRadius: "12px",
        cursor: available ? "pointer" : "not-allowed",
        opacity: available ? 1 : 0.5,
        transition: "all 0.18s ease",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        boxShadow: featured ? `0 0 24px ${color}22` : "none",
      }}
      onMouseEnter={(e) => {
        if (available) (e.currentTarget as HTMLDivElement).style.background = hoverBg;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = baseBg;
      }}
    >
      {featured && (
        <span
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            fontSize: "9px",
            padding: "3px 8px",
            borderRadius: "999px",
            background: color,
            color: "white",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          ⚡ Nouveau
        </span>
      )}
      <div
        style={{
          width: "44px",
          height: "44px",
          borderRadius: "10px",
          background: `${color}18`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={22} color={color} strokeWidth={1.7} />
      </div>
      <div>
        <div
          style={{
            color: "#f0f6fc",
            fontSize: "16px",
            fontWeight: 700,
            marginBottom: "4px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {label}
          {!available && (
            <span
              style={{
                fontSize: "10px",
                padding: "2px 7px",
                borderRadius: "999px",
                background: "#21262d",
                color: "#6e7681",
                fontWeight: 600,
              }}
            >
              Bientôt
            </span>
          )}
        </div>
        <div style={{ color: "#8b949e", fontSize: "12px" }}>{desc}</div>
      </div>
      {available && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            color: color,
            fontSize: "13px",
            fontWeight: 600,
            marginTop: "auto",
          }}
        >
          Lancer <ArrowRight size={14} />
        </div>
      )}
    </div>
  );
}
